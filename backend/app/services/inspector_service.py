from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.constants import LOCALHOSTS
from backend.app.core.exceptions import (DatabaseConnectionError,
                                         ValidationError)
from backend.app.core.security import decrypt_password
from backend.app.models.models import DBType
from backend.app.repositories.connection_repository import \
    connection_repository
from backend.app.schemas.schema_def import (ColumnDef, ForeignKeyDef, IndexDef,
                                            SchemaDef, TableDef)


class DatabaseInspectorService:

    async def get_database_schema(self, db: AsyncSession) -> Dict[str, Any]:
        schema = {
            "tables": [],
            "relationships": []
        }

        def get_inspector_data(connection):
            inspector = inspect(connection)
            table_names = inspector.get_table_names()

            tables_data = []
            for table_name in table_names:
                columns = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                foreign_keys = inspector.get_foreign_keys(table_name)
                indexes = inspector.get_indexes(table_name)

                tables_data.append({
                    "name": table_name,
                    "columns": columns,
                    "primary_key": pk_constraint,
                    "foreign_keys": foreign_keys,
                    "indexes": indexes
                })

            return tables_data

        tables_data = await db.run_sync(get_inspector_data)
        schema["tables"] = tables_data

        return schema

    async def get_table_info(self, db: AsyncSession,
                             table_name: str) -> Dict[str, Any]:
        def get_table_data(connection):
            inspector = inspect(connection)

            return {
                "name": table_name,
                "columns": inspector.get_columns(table_name),
                "primary_key": inspector.get_pk_constraint(table_name),
                "foreign_keys": inspector.get_foreign_keys(table_name),
                "indexes": inspector.get_indexes(table_name),
                "check_constraints": inspector.get_check_constraints(
                    table_name
                ),
                "unique_constraints": inspector.get_unique_constraints(
                    table_name
                )
            }

        return await db.run_sync(get_table_data)

    async def get_table_sample(
        self,
        db: AsyncSession,
        table_name: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        query = text(f"SELECT * FROM {table_name} LIMIT :limit")
        result = await db.execute(query, {"limit": limit})
        rows = result.fetchall()

        return [dict(row._mapping) for row in rows]

    def format_schema_for_llm(self, schema: Dict[str, Any]) -> str:
        output = []

        for table in schema["tables"]:
            output.append(f"\nTable: {table['name']}")
            output.append("Columns:")

            for col in table["columns"]:
                col_type = str(col["type"])
                nullable = "NULL" if col["nullable"] else "NOT NULL"
                output.append(f"  - {col['name']}: {col_type} {nullable}")

            if table["primary_key"] and table["primary_key"].get(
                    "constrained_columns"):
                pk_cols = ", ".join(
                    table["primary_key"]["constrained_columns"])
                output.append(f"Primary Key: ({pk_cols})")

            if table["indexes"]:
                output.append("Indexes:")
                for idx in table["indexes"]:
                    idx_cols = ", ".join(idx["column_names"])
                    unique = "UNIQUE" if idx.get("unique") else ""
                    output.append(f"  - {idx['name']}: ({idx_cols}) {unique}")

        return "\n".join(output)

    async def sync_schema(
            self,
            db: AsyncSession,
            connection_id: UUID) -> SchemaDef:
        connection = await connection_repository.get(db, id=connection_id)

        password = decrypt_password(connection.db_password)

        resolved_host = connection.host
        if connection.host in LOCALHOSTS:
            resolved_host = 'host.docker.internal'

        if connection.db_type == DBType.POSTGRES:
            db_url = (
                f"postgresql://{connection.username}:{password}@"
                f"{resolved_host}:{connection.port}/{connection.db_name}"
            )
        elif connection.db_type == DBType.MYSQL:
            db_url = (
                f"mysql+pymysql://{connection.username}:{password}@"
                f"{resolved_host}:{connection.port}/{connection.db_name}"
            )
        else:
            raise ValidationError(
                f"Unsupported database type: {connection.db_type}")

        try:
            engine = create_engine(db_url)
            inspector = inspect(engine)

            tables = []
            table_names = inspector.get_table_names()

            for table_name in table_names:
                columns_info = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                pk_columns = set(pk_constraint.get('constrained_columns', []))

                columns = []
                for col in columns_info:
                    columns.append(
                        ColumnDef(
                            name=col['name'],
                            type=str(col['type']),
                            is_pk=col['name'] in pk_columns,
                            is_nullable=col.get('nullable', True),
                            default=(
                                str(col.get('default'))
                                if col.get('default') is not None
                                else None
                            )
                        )
                    )

                fk_info = inspector.get_foreign_keys(table_name)
                foreign_keys = []
                for fk in fk_info:
                    if (
                        fk.get('constrained_columns') and
                        fk.get('referred_columns')
                    ):
                        for i, col in enumerate(fk['constrained_columns']):
                            foreign_keys.append(
                                ForeignKeyDef(
                                    column=col,
                                    ref_table=fk['referred_table'],
                                    ref_column=(
                                        fk['referred_columns'][i]
                                        if i < len(fk['referred_columns'])
                                        else fk['referred_columns'][0]
                                    )
                                )
                            )

                index_info = inspector.get_indexes(table_name)
                indexes = []
                for idx in index_info:
                    indexes.append(IndexDef(
                        name=idx['name'],
                        column_names=idx.get('column_names', []),
                        unique=idx.get('unique', False)
                    ))

                row_count = None
                sample_data = []
                sample_size = 10

                try:
                    with engine.connect() as conn:
                        result = conn.execute(
                            text(f"SELECT COUNT(*) FROM {table_name}"))
                        row_count = result.scalar()

                        if row_count and row_count > 0:
                            actual_sample_size = min(
                                sample_size, 500, row_count)

                            if connection.db_type == DBType.POSTGRES:
                                random_clause = "ORDER BY RANDOM()"
                            elif connection.db_type == DBType.MYSQL:
                                random_clause = "ORDER BY RAND()"
                            else:
                                random_clause = ""

                            sample_query = (
                                f"SELECT * FROM {table_name} {random_clause} "
                                f"LIMIT {actual_sample_size}"
                            )
                            result = conn.execute(text(sample_query))

                            for row in result.mappings():
                                row_dict = {}
                                for key, value in row.items():
                                    if value is None:
                                        row_dict[key] = None
                                    elif isinstance(value, dict):
                                        # JSON/JSONB data - keep as dict
                                        row_dict[key] = value
                                    elif isinstance(value, (str, int, float,
                                                    bool)):
                                        long_str = isinstance(value, str) and \
                                                   len(value) > 500
                                        if long_str:
                                            row_dict[key] = value[:500] + "..."
                                        else:
                                            row_dict[key] = value
                                    else:
                                        # For other complex types, convert
                                        # to string
                                        str_value = str(value)
                                        if len(str_value) > 500:
                                            row_dict[key] = str_value[:500] + \
                                                "..."
                                        else:
                                            row_dict[key] = str_value
                                sample_data.append(row_dict)

                except Exception as e:
                    import logging
                    logging.warning(
                        f"Failed to sample data from {table_name}: {str(e)}")

                tables.append(TableDef(
                    name=table_name,
                    columns=columns,
                    foreign_keys=foreign_keys,
                    indexes=indexes,
                    row_count=row_count,
                    sample_data=sample_data
                ))

            schema_def = SchemaDef(tables=tables)

            await connection_repository.update_schema(
                db=db,
                connection_id=connection_id,
                meta_schema=schema_def.to_json_dict()
            )

            engine.dispose()

            return schema_def

        except Exception as e:
            raise DatabaseConnectionError(
                f"Failed to connect to target database: {str(e)}")


inspector_service = DatabaseInspectorService()
