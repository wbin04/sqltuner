"""
Simulation Execution Service
Executes SQL queries against virtual schemas using in-memory SQLite
"""
from typing import Dict, List, Any, Optional
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError, ProgrammingError
import json
import re
import sqlparse


class SimulationExecutor:
    """
    Executes SQL queries on ephemeral in-memory SQLite databases
    Maps PostgreSQL schema definitions to SQLite-compatible schema
    """
    
    @staticmethod
    def _execute_statements(conn, sql_query: str) -> Dict[str, Any]:
        """
        Execute SQL query supporting multiple statements
        
        Args:
            conn: Database connection
            sql_query: SQL query (may contain multiple statements)
            
        Returns:
            Dictionary with columns and rows from final SELECT statement
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Split SQL query into individual statements
        statements = sqlparse.split(sql_query)
        # Filter out empty statements and whitespace-only statements
        statements = [stmt.strip() for stmt in statements if stmt.strip() and stmt.strip() != ';']
        
        if not statements:
            raise ValueError("No valid SQL statements found")
        
        logger.info(f"[EXECUTE] Split into {len(statements)} statements")
        
        final_columns = []
        final_rows = []
        
        for i, stmt in enumerate(statements):
            logger.debug(f"[EXECUTE] Executing statement {i+1}: {stmt[:100]}...")
            
            try:
                result = conn.execute(text(stmt))
                
                # Check if this statement returns rows (SELECT)
                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [dict(row._mapping) for row in result.fetchall()]
                    final_columns = columns
                    final_rows = rows
                    logger.debug(f"[EXECUTE] Statement {i+1} returned {len(rows)} rows")
                else:
                    # For DDL/DML statements, just commit
                    conn.commit()
                    logger.debug(f"[EXECUTE] Statement {i+1} executed (no rows returned)")
                    
            except Exception as stmt_error:
                error_str = str(stmt_error)
                
                # Check if it's a duplicate index error (treat as warning, not failure)
                is_duplicate_index = (
                    "Duplicate key name" in error_str or  # MySQL
                    "already exists" in error_str or       # PostgreSQL
                    "duplicate key" in error_str.lower() or
                    "index" in stmt.upper() and "already" in error_str.lower()  # SQLite
                )
                
                if is_duplicate_index and "CREATE INDEX" in stmt.upper():
                    logger.warning(f"[EXECUTE] Statement {i+1} skipped: Index already exists")
                    # Continue to next statement instead of failing
                    continue
                    
                logger.error(f"[EXECUTE] Statement {i+1} failed: {error_str}")
                # For multi-statement execution, if one fails, stop and return error
                raise Exception(f"Statement {i+1} failed: {error_str}")
        
        return {
            "columns": final_columns,
            "rows": final_rows,
            "row_count": len(final_rows)
        }
    
    @staticmethod
    def execute_real_db_statements(conn, sql_query: str) -> Dict[str, Any]:
        """
        Execute SQL query on real database supporting multiple statements
        
        Args:
            conn: Database connection
            sql_query: SQL query (may contain multiple statements)
            
        Returns:
            Dictionary with columns and rows from final SELECT statement
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Split SQL query into individual statements
        statements = sqlparse.split(sql_query)
        # Filter out empty statements and whitespace-only statements
        statements = [stmt.strip() for stmt in statements if stmt.strip() and stmt.strip() != ';']
        
        if not statements:
            raise ValueError("No valid SQL statements found")
        
        logger.info(f"[REAL_DB] Split into {len(statements)} statements")
        
        final_columns = []
        final_rows = []
        
        for i, stmt in enumerate(statements):
            logger.debug(f"[REAL_DB] Executing statement {i+1}: {stmt[:100]}...")
            
            try:
                result = conn.execute(text(stmt))
                
                # Check if this statement returns rows (SELECT)
                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [dict(row._mapping) for row in result.fetchall()]
                    final_columns = columns
                    final_rows = rows
                    logger.debug(f"[REAL_DB] Statement {i+1} returned {len(rows)} rows")
                else:
                    # For DDL/DML statements, commit is handled by context manager
                    logger.debug(f"[REAL_DB] Statement {i+1} executed (no rows returned)")
                    
            except Exception as stmt_error:
                error_str = str(stmt_error)
                
                # Check if it's a duplicate index error (treat as warning, not failure)
                is_duplicate_index = (
                    "Duplicate key name" in error_str or  # MySQL
                    "already exists" in error_str or       # PostgreSQL
                    "duplicate key" in error_str.lower()
                )
                
                if is_duplicate_index and "CREATE INDEX" in stmt.upper():
                    logger.warning(f"[REAL_DB] Statement {i+1} skipped: Index already exists")
                    # Continue to next statement instead of failing
                    continue
                    
                logger.error(f"[REAL_DB] Statement {i+1} failed: {error_str}")
                # For multi-statement execution, if one fails, stop and return error
                raise Exception(f"Statement {i+1} failed: {error_str}")
        
        return {
            "columns": final_columns,
            "rows": final_rows,
            "row_count": len(final_rows)
        }
    
    @staticmethod
    def _map_postgres_to_sqlite(pg_type: str) -> str:
        """
        Convert PostgreSQL data types to SQLite-compatible types
        
        Args:
            pg_type: PostgreSQL type name (e.g., 'UUID', 'TIMESTAMPTZ', 'VARCHAR(255)')
            
        Returns:
            SQLite-compatible type
        """
        # Normalize to uppercase for comparison
        pg_type_upper = pg_type.upper().strip()
        
        # UUID -> TEXT
        if 'UUID' in pg_type_upper:
            return 'TEXT'
        
        # JSON types -> TEXT
        if pg_type_upper in ('JSONB', 'JSON'):
            return 'TEXT'
        
        # Timestamp types -> TEXT (SQLite will store as ISO8601 strings)
        if pg_type_upper in ('TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE', 'TIMESTAMP'):
            return 'TEXT'
        
        # Array types -> TEXT (store as JSON string)
        if 'ARRAY' in pg_type_upper or pg_type_upper.startswith('_'):
            return 'TEXT'
        
        # Serial types -> INTEGER
        if pg_type_upper in ('SERIAL', 'BIGSERIAL', 'SMALLSERIAL'):
            return 'INTEGER'
        
        # Boolean -> INTEGER (0/1)
        if pg_type_upper in ('BOOLEAN', 'BOOL'):
            return 'INTEGER'
        
        # Numeric types that work in both
        if any(t in pg_type_upper for t in ['INT', 'INTEGER', 'BIGINT', 'SMALLINT']):
            return 'INTEGER'
        
        if any(t in pg_type_upper for t in ['FLOAT', 'DOUBLE', 'REAL', 'NUMERIC', 'DECIMAL']):
            return 'REAL'
        
        # Text types - extract length if present
        if 'VARCHAR' in pg_type_upper or 'CHAR' in pg_type_upper:
            return pg_type  # Keep VARCHAR(n) as is, SQLite accepts it
        
        if pg_type_upper == 'TEXT':
            return 'TEXT'
        
        # Default: keep original (many types work on both)
        return pg_type
    
    @staticmethod
    def _sanitize_value_for_sqlite(value: Any, data_type: str) -> str:
        """
        Sanitize and format values for SQLite INSERT
        
        Args:
            value: The value to insert
            data_type: The target SQLite data type
            
        Returns:
            Properly formatted SQL value string
        """
        if value is None:
            return 'NULL'
        
        # For TEXT types, ensure proper escaping
        if data_type == 'TEXT':
            if isinstance(value, dict) or isinstance(value, list):
                # JSON objects/arrays -> stringify
                return f"'{json.dumps(value).replace(chr(39), chr(39) + chr(39))}'"
            else:
                # Regular strings -> escape single quotes
                return f"'{str(value).replace(chr(39), chr(39) + chr(39))}'"
        
        # For INTEGER/REAL, convert to number
        if data_type in ('INTEGER', 'REAL'):
            # Boolean -> 0/1
            if isinstance(value, bool):
                return '1' if value else '0'
            return str(value)
        
        # Default: quote as string
        return f"'{str(value).replace(chr(39), chr(39) + chr(39))}'"
    
    def execute(
        self, 
        meta_schema: Dict[str, Any], 
        sql_query: str,
        sample_data: Optional[Dict[str, List[Dict]]] = None
    ) -> Dict[str, Any]:
        """
        Execute SQL query against virtual schema in SQLite
        
        Args:
            meta_schema: Schema definition with tables and columns
            sql_query: User's SQL query to execute
            sample_data: Optional sample data (deprecated - now uses meta_schema.tables[].sample_data)
            
        Returns:
            Dictionary with columns and rows
            
        Raises:
            Exception: If query execution fails
        """
        # Create in-memory SQLite database
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            echo=False  # Set to True for debugging
        )
        
        try:
            with engine.connect() as conn:
                # Step 1: Build and execute CREATE TABLE statements
                tables = meta_schema.get('tables', [])
                
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"[SANDBOX] Creating {len(tables)} tables in SQLite sandbox")
                
                for table in tables:
                    table_name = table.get('name')
                    columns = table.get('columns', [])
                    
                    if not table_name or not columns:
                        continue
                    
                    logger.info(f"[SANDBOX] Creating table '{table_name}' with {len(columns)} columns")
                    
                    # Build column definitions
                    col_defs = []
                    primary_keys = []
                    
                    for col in columns:
                        col_name = col.get('name')
                        pg_type = col.get('type', 'TEXT')  # Changed from 'data_type' to 'type'
                        nullable = col.get('is_nullable', True)  # Changed from 'nullable'
                        is_pk = col.get('is_pk', False)  # Changed from 'primary_key'
                        
                        # Map type to SQLite
                        sqlite_type = self._map_postgres_to_sqlite(pg_type)
                        
                        # Build column definition
                        col_def = f'"{col_name}" {sqlite_type}'
                        
                        if not nullable:
                            col_def += ' NOT NULL'
                        
                        if is_pk:
                            primary_keys.append(col_name)
                        
                        col_defs.append(col_def)
                    
                    # Add PRIMARY KEY constraint if any
                    if primary_keys:
                        pk_cols = ", ".join(f'"{pk}"' for pk in primary_keys)
                        pk_constraint = f'PRIMARY KEY ({pk_cols})'
                        col_defs.append(pk_constraint)
                    
                    # Execute CREATE TABLE
                    col_defs_str = ",\n  ".join(col_defs)
                    create_stmt = f'CREATE TABLE "{table_name}" (\n  {col_defs_str}\n);'
                    logger.debug(f"[SANDBOX] SQL: {create_stmt}")
                    conn.execute(text(create_stmt))
                    conn.commit()
                    
                    # Log created columns for debugging
                    col_names = [col.get('name') for col in columns]
                    logger.info(f"[SANDBOX] Table '{table_name}' created with columns: {', '.join(col_names)}")
                
                # Step 2: Seed sample data from table definitions or legacy sample_data param
                total_seeded_rows = 0
                for table in tables:
                    table_name = table.get('name')
                    # Use table's own sample_data first, fall back to legacy param
                    rows = table.get('sample_data', [])
                    
                    if not rows and sample_data:
                        # Fall back to legacy sample_data parameter
                        rows = sample_data.get(table_name, [])
                    
                    if not rows:
                        logger.debug(f"[SANDBOX] No sample data for table '{table_name}'")
                        continue
                    
                    logger.info(f"[SANDBOX] Seeding {len(rows)} rows into table '{table_name}'")
                    
                    # Build type map for proper value formatting
                    type_map = {}
                    for col in table.get('columns', []):
                        col_name = col.get('name')
                        pg_type = col.get('type', 'TEXT')
                        type_map[col_name] = self._map_postgres_to_sqlite(pg_type)
                    
                    # Insert rows
                    for row in rows:
                        columns_list = list(row.keys())
                        values_list = [
                            self._sanitize_value_for_sqlite(row[col], type_map.get(col, 'TEXT'))
                            for col in columns_list
                        ]
                        
                        # Build INSERT statement without backslash in f-string
                        cols_str = ", ".join(f'"{c}"' for c in columns_list)
                        vals_str = ", ".join(values_list)
                        insert_stmt = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({vals_str});'
                        conn.execute(text(insert_stmt))
                        total_seeded_rows += 1
                    
                    conn.commit()
                    logger.info(f"[SANDBOX] Successfully seeded {len(rows)} rows into '{table_name}'")
                
                logger.info(f"[SANDBOX] Total seeded rows: {total_seeded_rows}")
                
                # Step 3: Execute user query (supporting multiple statements)
                result = self._execute_statements(conn, sql_query)
                
                return result
        
        finally:
            # Cleanup
            engine.dispose()


# Singleton instance
simulation_executor = SimulationExecutor()
