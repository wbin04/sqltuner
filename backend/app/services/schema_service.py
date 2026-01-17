"""
Schema Synchronization Service
Extracts database metadata from target databases and caches it for LLM context
"""
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy import create_engine, inspect, MetaData
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.models.models import DBConnection, DBType
from backend.app.core.security import decrypt_password
import logging

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for syncing database schema metadata"""
    
    @staticmethod
    def _build_connection_string(
        db_type: DBType,
        host: str,
        port: int,
        username: str,
        password: str,
        db_name: str
    ) -> str:
        """
        Build database connection string based on database type
        
        Args:
            db_type: Type of database (postgres/mysql)
            host: Database host
            port: Database port
            username: Database username
            password: Decrypted password
            db_name: Database name
            
        Returns:
            Connection string for SQLAlchemy
        """
        if db_type == DBType.POSTGRES:
            return f"postgresql://{username}:{password}@{host}:{port}/{db_name}"
        elif db_type == DBType.MYSQL:
            return f"mysql+pymysql://{username}:{password}@{host}:{port}/{db_name}"
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
    
    @staticmethod
    def _extract_column_info(column_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and format column information in LLM-optimized format
        
        Args:
            column_info: Raw column info from inspector
            
        Returns:
            Formatted column information with minimal tokens
        """
        result = {
            "name": column_info["name"],
            "type": str(column_info["type"]),
        }
        
        # Add nullable info (only if True to save tokens)
        if column_info.get("nullable", True):
            result["nullable"] = True
        
        # Add default value if exists
        if column_info.get("default") is not None:
            result["default"] = str(column_info["default"])
        
        return result
    
    @staticmethod
    def _inspect_schema(engine: Engine) -> Dict[str, List[Dict[str, Any]]]:
        """
        Inspect database schema and extract metadata
        
        Args:
            engine: SQLAlchemy engine connected to target database
            
        Returns:
            Dictionary mapping table names to column definitions
            Format: {
                "table_name": [
                    {"name": "id", "type": "INTEGER", "pk": true},
                    {"name": "user_id", "type": "UUID", "fk": "users.id"}
                ]
            }
        """
        inspector = inspect(engine)
        schema_data = {}
        
        try:
            # Get all table names
            table_names = inspector.get_table_names()
            logger.info(f"Found {len(table_names)} tables in target database")
            
            for table_name in table_names:
                columns = []
                
                # Get column information
                raw_columns = inspector.get_columns(table_name)
                
                # Get primary keys
                pk_constraint = inspector.get_pk_constraint(table_name)
                pk_columns = set(pk_constraint.get("constrained_columns", []))
                
                # Get foreign keys
                fk_constraints = inspector.get_foreign_keys(table_name)
                fk_map = {}  # Map column name to referenced table.column
                for fk in fk_constraints:
                    for col, ref_col in zip(
                        fk.get("constrained_columns", []),
                        fk.get("referred_columns", [])
                    ):
                        ref_table = fk.get("referred_table", "")
                        fk_map[col] = f"{ref_table}.{ref_col}"
                
                # Process each column
                for col_info in raw_columns:
                    col_data = SchemaService._extract_column_info(col_info)
                    col_name = col_data["name"]
                    
                    # Mark primary key
                    if col_name in pk_columns:
                        col_data["pk"] = True
                    
                    # Add foreign key reference
                    if col_name in fk_map:
                        col_data["fk"] = fk_map[col_name]
                    
                    columns.append(col_data)
                
                schema_data[table_name] = columns
                logger.debug(f"Extracted schema for table '{table_name}': {len(columns)} columns")
            
            return schema_data
            
        except Exception as e:
            logger.error(f"Error inspecting schema: {str(e)}")
            raise
    
    @staticmethod
    async def sync_connection_schema(
        connection_id: UUID,
        db: AsyncSession,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Synchronize database schema metadata from target database
        
        Args:
            connection_id: UUID of the database connection
            db: Async database session
            force: Force re-sync even if cache exists
            
        Returns:
            Dictionary containing:
                - success: bool
                - message: str
                - tables_count: int (if successful)
                - schema: dict (if successful)
                
        Raises:
            ValueError: If connection not found or invalid
            SQLAlchemyError: If database connection fails
        """
        try:
            # Retrieve connection from database
            result = await db.execute(
                select(DBConnection).where(DBConnection.id == connection_id)
            )
            connection = result.scalar_one_or_none()
            
            if not connection:
                raise ValueError(f"Database connection with ID {connection_id} not found")
            
            # Check if cache exists and force is not set
            if connection.metadata_cache and not force:
                logger.info(f"Using cached schema for connection {connection_id}")
                return {
                    "success": True,
                    "message": "Using cached schema metadata",
                    "tables_count": len(connection.metadata_cache),
                    "schema": connection.metadata_cache
                }
            
            # Decrypt password
            try:
                plain_password = decrypt_password(connection.encrypted_password)
            except Exception as e:
                raise ValueError(f"Failed to decrypt password: {str(e)}")
            
            # Build connection string
            conn_string = SchemaService._build_connection_string(
                db_type=connection.db_type,
                host=connection.host,
                port=connection.port,
                username=connection.username,
                password=plain_password,
                db_name=connection.db_name
            )
            
            # Create synchronous engine for inspection
            # Note: Inspector requires sync engine
            logger.info(f"Connecting to target database: {connection.host}:{connection.port}/{connection.db_name}")
            temp_engine = create_engine(
                conn_string,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,   # Recycle connections after 1 hour
                connect_args={"connect_timeout": 10}  # 10 second timeout
            )
            
            try:
                # Test connection
                with temp_engine.connect() as conn:
                    logger.info("Successfully connected to target database")
                
                # Extract schema metadata
                schema_data = SchemaService._inspect_schema(temp_engine)
                
                # Update cache in database
                connection.metadata_cache = schema_data
                await db.commit()
                await db.refresh(connection)
                
                logger.info(f"Successfully synced schema for connection {connection_id}: {len(schema_data)} tables")
                
                return {
                    "success": True,
                    "message": "Schema metadata synced successfully",
                    "tables_count": len(schema_data),
                    "schema": schema_data
                }
                
            finally:
                # Always dispose of the temporary engine
                temp_engine.dispose()
                logger.debug("Disposed temporary database engine")
                
        except ValueError as e:
            logger.error(f"Validation error: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }
        except SQLAlchemyError as e:
            logger.error(f"Database connection error: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to connect to target database: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error during schema sync: {str(e)}")
            return {
                "success": False,
                "message": f"Unexpected error: {str(e)}"
            }
    
    @staticmethod
    async def get_cached_schema(
        connection_id: UUID,
        db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached schema metadata for a connection
        
        Args:
            connection_id: UUID of the database connection
            db: Async database session
            
        Returns:
            Cached schema dict or None if not cached
        """
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        
        if not connection:
            return None
        
        return connection.metadata_cache
