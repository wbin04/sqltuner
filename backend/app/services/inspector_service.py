from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Any


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


# Singleton instance
inspector_service = DatabaseInspectorService()
