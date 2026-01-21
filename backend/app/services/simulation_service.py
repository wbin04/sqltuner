"""
Service for managing simulation (virtual) database connections
Handles schema metadata and DDL generation
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, Optional
from uuid import UUID

from backend.app.models.models import DBConnection
from backend.app.schemas.schema_def import SchemaDef, TableDef, ColumnDef, ForeignKeyDef


class SimulationService:
    """
    Service for handling virtual database simulations
    Manages JSON schema metadata and generates SQL DDL scripts
    """
    
    async def update_table_metadata(
        self, 
        db: AsyncSession, 
        connection_id: UUID, 
        schema_update: SchemaDef
    ) -> SchemaDef:
        """
        Update the meta_schema JSON for a simulation connection
        
        Args:
            db: Async database session
            connection_id: UUID of the simulation connection
            schema_update: New schema definition to save
            
        Returns:
            Updated SchemaDef object
            
        Raises:
            ValueError: If connection not found or not a simulation
        """
        # Fetch connection
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        
        if not connection:
            raise ValueError(f"Connection {connection_id} not found")
        
        # Note: We'll check db_type once migration is applied
        # For now, just update the meta_schema
        
        # Convert schema to JSON and save
        connection.meta_schema = schema_update.to_json_dict()
        
        await db.commit()
        await db.refresh(connection)
        
        return schema_update
    
    async def get_schema_metadata(
        self, 
        db: AsyncSession, 
        connection_id: UUID
    ) -> Optional[SchemaDef]:
        """
        Retrieve the meta_schema for a connection
        
        Args:
            db: Async database session
            connection_id: UUID of the connection
            
        Returns:
            SchemaDef object or None if no schema exists
        """
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        
        if not connection or not connection.meta_schema:
            return None
        
        return SchemaDef.from_json_dict(connection.meta_schema)
    
    def generate_ddl_script(self, schema_def: SchemaDef) -> str:
        """
        Generate SQL DDL script from schema definition
        Converts JSON structure to CREATE TABLE statements
        
        Args:
            schema_def: Schema definition object
            
        Returns:
            SQL DDL script as string
        """
        ddl_lines = []
        ddl_lines.append("-- Generated DDL Script from Schema Definition")
        ddl_lines.append("-- This script can be used as context for AI query generation\n")
        
        # Generate CREATE TABLE statements
        for table in schema_def.tables:
            ddl_lines.append(f"CREATE TABLE {table.name} (")
            
            # Column definitions
            col_defs = []
            for col in table.columns:
                col_def = f"    {col.name} {col.type}"
                
                if not col.is_nullable:
                    col_def += " NOT NULL"
                
                if col.default is not None:
                    col_def += f" DEFAULT {col.default}"
                
                col_defs.append(col_def)
            
            # Primary key constraint
            pk_columns = [col.name for col in table.columns if col.is_pk]
            if pk_columns:
                pk_def = f"    PRIMARY KEY ({', '.join(pk_columns)})"
                col_defs.append(pk_def)
            
            ddl_lines.append(",\n".join(col_defs))
            ddl_lines.append(");\n")
        
        # Generate ALTER TABLE for foreign keys
        for table in schema_def.tables:
            for fk in table.foreign_keys:
                fk_name = f"fk_{table.name}_{fk.column}"
                ddl_lines.append(
                    f"ALTER TABLE {table.name} "
                    f"ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY ({fk.column}) "
                    f"REFERENCES {fk.ref_table}({fk.ref_column});\n"
                )
        
        # Generate INSERT statements for sample data
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
                            # Escape single quotes
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
        """
        Generate DDL script for a specific connection
        
        Args:
            db: Async database session
            connection_id: UUID of the connection
            
        Returns:
            SQL DDL script as string
            
        Raises:
            ValueError: If connection not found or has no schema
        """
        schema_def = await self.get_schema_metadata(db, connection_id)
        
        if not schema_def:
            raise ValueError(f"No schema metadata found for connection {connection_id}")
        
        return self.generate_ddl_script(schema_def)


# Singleton instance
simulation_service = SimulationService()
