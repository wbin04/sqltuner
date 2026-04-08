from typing import Optional
from uuid import UUID

from app.core.exceptions import NotFoundError
from app.models.models import DBConnection
from app.schemas.schema_def import SchemaDef
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


class SimulationService:
    async def update_table_metadata(
        self,
        db: AsyncSession,
        connection_id: UUID,
        schema_update: SchemaDef
    ) -> SchemaDef:
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()

        if not connection:
            raise NotFoundError(f"Connection {connection_id} not found")

        connection.meta_schema = schema_update.to_json_dict()

        await db.commit()
        await db.refresh(connection)

        return schema_update

    async def get_schema_metadata(
        self,
        db: AsyncSession,
        connection_id: UUID
    ) -> Optional[SchemaDef]:
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()

        if not connection or not connection.meta_schema:
            return None

        return SchemaDef.from_json_dict(connection.meta_schema)

    def generate_ddl_script(self, schema_def: SchemaDef) -> str:
        ddl_lines = []
        ddl_lines.append("-- Generated DDL Script from Schema Definition")
        ddl_lines.append(
            "-- This script can be used as context for AI query generation\n"
        )

        for table in schema_def.tables:
            ddl_lines.append(f"CREATE TABLE {table.name} (")

            col_defs = []
            for col in table.columns:
                col_def = f"    {col.name} {col.type}"

                if not col.is_nullable:
                    col_def += " NOT NULL"

                if col.default is not None:
                    col_def += f" DEFAULT {col.default}"

                col_defs.append(col_def)

            pk_columns = [col.name for col in table.columns if col.is_pk]
            if pk_columns:
                pk_def = f"    PRIMARY KEY ({', '.join(pk_columns)})"
                col_defs.append(pk_def)

            ddl_lines.append(",\n".join(col_defs))
            ddl_lines.append(");\n")

        for table in schema_def.tables:
            for fk in table.foreign_keys:
                fk_name = f"fk_{table.name}_{fk.column}"
                ddl_lines.append(
                    f"ALTER TABLE {table.name} "
                    f"ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY ({fk.column}) "
                    f"REFERENCES {fk.ref_table}({fk.ref_column});\n"
                )

        for table in schema_def.tables:
            if table.sample_data:
                ddl_lines.append(f"\n-- Sample data for {table.name}")
                for row in table.sample_data:
                    columns = list(row.keys())
                    values = []
                    for val in row.values():
                        if val is None:
                            values.append("NULL")
                        elif isinstance(val, str):
                            escaped_val = val.replace("'", "''")
                            values.append(f"'{escaped_val}'")
                        else:
                            values.append(str(val))

                    ddl_lines.append(
                        f"INSERT INTO {table.name} ({', '.join(columns)}) "
                        f"VALUES ({', '.join(values)});"
                    )
                ddl_lines.append("")

        return "\n".join(ddl_lines)

    async def generate_ddl_for_connection(
        self,
        db: AsyncSession,
        connection_id: UUID
    ) -> str:
        schema_def = await self.get_schema_metadata(db, connection_id)

        if not schema_def:
            raise NotFoundError(
                f"No schema metadata found for connection {connection_id}"
            )

        return self.generate_ddl_script(schema_def)

    def generate_sql_export(self, meta_schema: dict) -> str:
        """
        Sinh SQL export từ raw meta_schema dict.
        Dùng được cho cả simulation và real DB.
        """
        if not meta_schema or "tables" not in meta_schema:
            raise ValueError("No schema data available to export")

        lines = []
        lines.append("-- SQLTuner Schema Export")
        lines.append(f"-- Generated at: {__import__('datetime').datetime.utcnow().isoformat()}Z")
        lines.append("")

        tables = meta_schema.get("tables", [])

        # CREATE TABLE statements
        for table in tables:
            table_name = table.get("name", "")
            columns = table.get("columns", [])
            foreign_keys = table.get("foreign_keys", [])
            indexes = table.get("indexes", [])

            lines.append(f"CREATE TABLE {table_name} (")
            col_defs = []

            for col in columns:
                col_name = col.get("name", "")
                col_type = col.get("type", col.get("data_type", "TEXT"))
                is_nullable = col.get("is_nullable", True)
                is_pk = col.get("is_pk", False)
                default_val = col.get("default")

                col_def = f"    {col_name} {col_type}"
                if not is_nullable:
                    col_def += " NOT NULL"
                if default_val is not None:
                    col_def += f" DEFAULT {default_val}"
                col_defs.append(col_def)

            pk_cols = [c.get("name") for c in columns if c.get("is_pk")]
            if pk_cols:
                col_defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")

            lines.append(",\n".join(col_defs))
            lines.append(");")
            lines.append("")

            # FOREIGN KEY constraints
            for fk in foreign_keys:
                fk_col = fk.get("column", "")
                ref_table = fk.get("ref_table", fk.get("referenced_table", ""))
                ref_col = fk.get("ref_column", fk.get("referenced_column", "id"))
                fk_name = f"fk_{table_name}_{fk_col}"
                lines.append(
                    f"ALTER TABLE {table_name} "
                    f"ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY ({fk_col}) "
                    f"REFERENCES {ref_table}({ref_col});"
                )

            # CREATE INDEX statements
            for idx in indexes:
                idx_name = idx.get("name", "")
                idx_cols = idx.get("column_names", [])
                unique = "UNIQUE " if idx.get("unique") else ""
                if idx_name and idx_cols:
                    lines.append(
                        f"CREATE {unique}INDEX {idx_name} "
                        f"ON {table_name} ({', '.join(idx_cols)});"
                    )

            if foreign_keys or indexes:
                lines.append("")

        # INSERT statements (sample_data — chỉ có ở simulation)
        for table in tables:
            table_name = table.get("name", "")
            sample_data = table.get("sample_data", [])
            if not sample_data:
                continue

            lines.append(f"-- Data for {table_name}")
            for row in sample_data:
                cols = list(row.keys())
                values = []
                for val in row.values():
                    if val is None:
                        values.append("NULL")
                    elif isinstance(val, bool):
                        values.append("TRUE" if val else "FALSE")
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        escaped = str(val).replace("'", "''")
                        values.append(f"'{escaped}'")
                lines.append(
                    f"INSERT INTO {table_name} ({', '.join(cols)}) "
                    f"VALUES ({', '.join(values)});"
                )
            lines.append("")

        return "\n".join(lines)

    def parse_sql_to_schema(self, sql_content: str) -> dict:
        """
        Parse SQL file content → meta_schema dict compatible với SchemaDef.
        Hỗ trợ: CREATE TABLE, ALTER TABLE ADD CONSTRAINT FOREIGN KEY,
                 CREATE INDEX, INSERT INTO.
        """
        import re

        tables: dict[str, dict] = {}
        table_order: list[str] = []

        # Normalize: bỏ comments, normalize whitespace
        sql = re.sub(r'--[^\n]*', '', sql_content)
        sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
        sql = sql.strip()

        # Parse CREATE TABLE
        create_pattern = re.compile(
            r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\[]?(\w+)[`"\]]?\s*\((.*?)\)\s*;',
            re.IGNORECASE | re.DOTALL
        )
        for match in create_pattern.finditer(sql):
            table_name = match.group(1)
            body = match.group(2)

            columns = []
            pk_columns = []

            for line in body.split('\n'):
                line = line.strip().rstrip(',').strip()
                if not line:
                    continue

                # PRIMARY KEY constraint line
                pk_match = re.match(
                    r'PRIMARY\s+KEY\s*\(([^)]+)\)', line, re.IGNORECASE
                )
                if pk_match:
                    pk_columns = [c.strip().strip('`"[]') for c in pk_match.group(1).split(',')]
                    continue

                # Skip FOREIGN KEY inline constraints in CREATE TABLE
                if re.match(r'(FOREIGN\s+KEY|CONSTRAINT|UNIQUE\s+KEY|KEY\s+)', line, re.IGNORECASE):
                    continue

                # Column definition: name type [modifiers...]
                col_match = re.match(r'[`"\[]?(\w+)[`"\]]?\s+(\S+(?:\([^)]*\))?)(.*)', line)
                if col_match:
                    col_name = col_match.group(1)
                    col_type = col_match.group(2).upper()
                    modifiers = col_match.group(3).upper()

                    is_pk = 'PRIMARY KEY' in modifiers
                    is_nullable = 'NOT NULL' not in modifiers
                    default_val = None
                    default_match = re.search(r'DEFAULT\s+(\S+)', modifiers)
                    if default_match:
                        default_val = default_match.group(1)

                    if is_pk:
                        pk_columns.append(col_name)

                    columns.append({
                        "name": col_name,
                        "type": col_type,
                        "is_pk": is_pk,
                        "is_nullable": is_nullable,
                        "default": default_val,
                    })

            # Apply pk_columns from PRIMARY KEY constraint line
            for col in columns:
                if col["name"] in pk_columns:
                    col["is_pk"] = True

            tables[table_name] = {
                "name": table_name,
                "columns": columns,
                "foreign_keys": [],
                "indexes": [],
                "sample_data": [],
            }
            table_order.append(table_name)

        # Parse ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY
        fk_pattern = re.compile(
            r'ALTER\s+TABLE\s+[`"\[]?(\w+)[`"\]]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?'
            r'FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)',
            re.IGNORECASE
        )
        for match in fk_pattern.finditer(sql):
            table_name = match.group(1)
            fk_col = match.group(2).strip().strip('`"[]')
            ref_table = match.group(3)
            ref_col = match.group(4).strip().strip('`"[]')
            if table_name in tables:
                tables[table_name]["foreign_keys"].append({
                    "column": fk_col,
                    "ref_table": ref_table,
                    "ref_column": ref_col,
                })

        # Parse CREATE INDEX
        idx_pattern = re.compile(
            r'CREATE\s+(UNIQUE\s+)?INDEX\s+[`"\[]?(\w+)[`"\]]?\s+ON\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)',
            re.IGNORECASE
        )
        for match in idx_pattern.finditer(sql):
            is_unique = bool(match.group(1))
            idx_name = match.group(2)
            table_name = match.group(3)
            idx_cols = [c.strip().strip('`"[]') for c in match.group(4).split(',')]
            if table_name in tables:
                tables[table_name]["indexes"].append({
                    "name": idx_name,
                    "column_names": idx_cols,
                    "unique": is_unique,
                })

        # Parse INSERT INTO
        insert_pattern = re.compile(
            r'INSERT\s+INTO\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)',
            re.IGNORECASE
        )
        for match in insert_pattern.finditer(sql):
            table_name = match.group(1)
            cols = [c.strip().strip('`"[]\'') for c in match.group(2).split(',')]
            raw_vals = match.group(3)

            # Parse values: handle quoted strings, NULL, numbers
            values = []
            for v in re.split(r",(?=(?:[^']*'[^']*')*[^']*$)", raw_vals):
                v = v.strip()
                if v.upper() == 'NULL':
                    values.append(None)
                elif v.startswith("'") and v.endswith("'"):
                    values.append(v[1:-1].replace("''", "'"))
                else:
                    try:
                        values.append(int(v))
                    except ValueError:
                        try:
                            values.append(float(v))
                        except ValueError:
                            values.append(v)

            if table_name in tables and len(cols) == len(values):
                tables[table_name]["sample_data"].append(dict(zip(cols, values)))

        if not tables:
            raise ValueError(
                "No CREATE TABLE statements found in SQL file. "
                "Please ensure the file contains valid SQL DDL statements."
            )

        return {"tables": [tables[name] for name in table_order if name in tables]}

    def parse_sqlite_to_schema(self, db_path: str) -> dict:
        import sqlite3
        
        tables: dict[str, dict] = {}
        table_order: list[str] = []

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            db_tables = cursor.fetchall()
            
            for table_row in db_tables:
                table_name = table_row['name']
                
                escaped_table_name = table_name.replace('"', '""')
                
                # Get PRAGMA table_info
                cursor.execute(f'PRAGMA table_info("{escaped_table_name}")')
                columns_info = cursor.fetchall()
                
                columns = []
                pk_cols = []
                for col in columns_info:
                    col_name = col['name']
                    col_type = col['type']
                    is_nullable = not col['notnull']
                    default_val = col['dflt_value']
                    is_pk = col['pk'] > 0
                    
                    if is_pk:
                        pk_cols.append(col_name)
                        
                    columns.append({
                        "name": col_name,
                        "type": col_type if col_type else "TEXT",
                        "is_pk": is_pk,
                        "is_nullable": is_nullable,
                        "default": default_val,
                    })
                    
                # Get PRAGMA foreign_key_list
                cursor.execute(f'PRAGMA foreign_key_list("{escaped_table_name}")')
                fks_info = cursor.fetchall()
                
                foreign_keys = []
                for fk in fks_info:
                    foreign_keys.append({
                        "column": fk['from'],
                        "ref_table": fk['table'],
                        "ref_column": fk['to'] if fk['to'] else 'id',
                    })
                    
                # Get indexes
                cursor.execute(f'PRAGMA index_list("{escaped_table_name}")')
                indexes_info = cursor.fetchall()
                indexes = []
                for idx in indexes_info:
                    # PRAGMA index_info
                    idx_name = idx['name']
                    escaped_idx_name = idx_name.replace('"', '""')
                    is_unique = idx['unique'] == 1
                    cursor.execute(f'PRAGMA index_info("{escaped_idx_name}")')
                    idx_cols_info = cursor.fetchall()
                    idx_cols = [c['name'] for c in idx_cols_info]
                    
                    if not idx_name.startswith("sqlite_autoindex_"):
                        indexes.append({
                            "name": idx_name,
                            "column_names": idx_cols,
                            "unique": is_unique,
                        })

                # Get sample data
                cursor.execute(f'SELECT * FROM "{escaped_table_name}" LIMIT 100')
                rows = cursor.fetchall()
                sample_data = []
                for row in rows:
                    sample_data.append(dict(row))
                    
                tables[table_name] = {
                    "name": table_name,
                    "columns": columns,
                    "foreign_keys": foreign_keys,
                    "indexes": indexes,
                    "sample_data": sample_data,
                }
                table_order.append(table_name)
                
        finally:
            conn.close()
            
        if not tables:
            raise ValueError(
                "No tables found in the SQLite file. "
            )

        return {"tables": [tables[name] for name in table_order]}

simulation_service = SimulationService()
