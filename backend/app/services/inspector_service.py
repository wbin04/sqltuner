from sqlalchemy import inspect, text, create_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List, Any, Optional
from uuid import UUID

from backend.app.models.models import DBConnection, DBType
from backend.app.schemas.schema_def import SchemaDef, TableDef, ColumnDef, ForeignKeyDef
from backend.app.core.security import decrypt_password


class DatabaseInspectorService:
    """
    Service for inspecting database structure
    Retrieves schema information: tables, columns, indexes, foreign keys
    """
    
    async def get_database_schema(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Get comprehensive database schema information
        
        Args:
            db: Async database session
            
        Returns:
            Dictionary containing tables, columns, indexes, and relationships
        """
        schema = {
            "tables": [],
            "relationships": []
        }
        
        # Get inspector (sync operation)
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
        
        # Execute sync operation in async context
        tables_data = await db.run_sync(get_inspector_data)
        schema["tables"] = tables_data
        
        return schema
    
    async def get_table_info(self, db: AsyncSession, table_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific table
        
        Args:
            db: Async database session
            table_name: Name of the table
            
        Returns:
            Dictionary containing table structure details
        """
        def get_table_data(connection):
            inspector = inspect(connection)
            
            return {
                "name": table_name,
                "columns": inspector.get_columns(table_name),
                "primary_key": inspector.get_pk_constraint(table_name),
                "foreign_keys": inspector.get_foreign_keys(table_name),
                "indexes": inspector.get_indexes(table_name),
                "check_constraints": inspector.get_check_constraints(table_name),
                "unique_constraints": inspector.get_unique_constraints(table_name)
            }
        
        return await db.run_sync(get_table_data)
    
    async def get_table_sample(
        self, 
        db: AsyncSession, 
        table_name: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get sample rows from a table
        
        Args:
            db: Async database session
            table_name: Name of the table
            limit: Number of rows to fetch
            
        Returns:
            List of sample rows
        """
        query = text(f"SELECT * FROM {table_name} LIMIT :limit")
        result = await db.execute(query, {"limit": limit})
        rows = result.fetchall()
        
        # Convert to list of dicts
        return [dict(row._mapping) for row in rows]
    
    def format_schema_for_llm(self, schema: Dict[str, Any]) -> str:
        """
        Format schema information into a readable string for LLM
        
        Args:
            schema: Schema dictionary from get_database_schema()
            
        Returns:
            Formatted schema string
        """
        output = []
        
        for table in schema["tables"]:
            output.append(f"\nTable: {table['name']}")
            output.append("Columns:")
            
            for col in table["columns"]:
                col_type = str(col["type"])
                nullable = "NULL" if col["nullable"] else "NOT NULL"
                output.append(f"  - {col['name']}: {col_type} {nullable}")
            
            if table["primary_key"] and table["primary_key"].get("constrained_columns"):
                pk_cols = ", ".join(table["primary_key"]["constrained_columns"])
                output.append(f"Primary Key: ({pk_cols})")
            
            if table["indexes"]:
                output.append("Indexes:")
                for idx in table["indexes"]:
                    idx_cols = ", ".join(idx["column_names"])
                    unique = "UNIQUE" if idx.get("unique") else ""
                    output.append(f"  - {idx['name']}: ({idx_cols}) {unique}")
        
        return "\n".join(output)
    
    async def sync_schema(self, db: AsyncSession, connection_id: UUID) -> SchemaDef:
        """
        Sync schema metadata from a real database connection to meta_schema JSON
        
        Args:
            db: Async database session (SQLTuner internal DB)
            connection_id: UUID of the connection to sync
            
        Returns:
            SchemaDef object containing the synchronized schema
            
        Raises:
            ValueError: If connection not found or is a simulation
            Exception: If unable to connect to target database
        """
        # Fetch connection details
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        
        if not connection:
            raise ValueError(f"Connection {connection_id} not found")
        
        if connection.db_type == DBType.POSTGRES and connection.db_type.value == 'simulation':
            raise ValueError("Cannot sync schema from a simulation connection")
        
        # Decrypt password
        password = decrypt_password(connection.db_password)
        
        # Build connection URL for target database
        if connection.db_type == DBType.POSTGRES:
            db_url = f"postgresql://{connection.username}:{password}@{connection.host}:{connection.port}/{connection.db_name}"
        elif connection.db_type == DBType.MYSQL:
            db_url = f"mysql+pymysql://{connection.username}:{password}@{connection.host}:{connection.port}/{connection.db_name}"
        else:
            raise ValueError(f"Unsupported database type: {connection.db_type}")
        
        # Connect to target database and extract schema
        try:
            engine = create_engine(db_url)
            inspector = inspect(engine)
            
            tables = []
            table_names = inspector.get_table_names()
            
            for table_name in table_names:
                # Get columns
                columns_info = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                pk_columns = set(pk_constraint.get('constrained_columns', []))
                
                columns = []
                for col in columns_info:
                    columns.append(ColumnDef(
                        name=col['name'],
                        type=str(col['type']),
                        is_pk=col['name'] in pk_columns,
                        is_nullable=col.get('nullable', True),
                        default=str(col.get('default')) if col.get('default') is not None else None
                    ))
                
                # Get foreign keys
                fk_info = inspector.get_foreign_keys(table_name)
                foreign_keys = []
                for fk in fk_info:
                    if fk.get('constrained_columns') and fk.get('referred_columns'):
                        for i, col in enumerate(fk['constrained_columns']):
                            foreign_keys.append(ForeignKeyDef(
                                column=col,
                                ref_table=fk['referred_table'],
                                ref_column=fk['referred_columns'][i] if i < len(fk['referred_columns']) else fk['referred_columns'][0]
                            ))
                
                # Get row count
                row_count = None
                try:
                    with engine.connect() as conn:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                        row_count = result.scalar()
                except Exception:
                    # If count fails, leave it as None
                    pass
                
                tables.append(TableDef(
                    name=table_name,
                    columns=columns,
                    foreign_keys=foreign_keys,
                    row_count=row_count
                ))
            
            schema_def = SchemaDef(tables=tables)
            
            # Update meta_schema in database
            connection.meta_schema = schema_def.to_json_dict()
            await db.commit()
            await db.refresh(connection)
            
            engine.dispose()
            
            return schema_def
            
        except Exception as e:
            raise Exception(f"Failed to connect to target database: {str(e)}")


# Singleton instance
inspector_service = DatabaseInspectorService()
