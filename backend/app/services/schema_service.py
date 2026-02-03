import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import decrypt_password
from backend.app.models.models import DBType
from backend.app.repositories.connection_repository import \
    connection_repository

logger = logging.getLogger(__name__)


class SchemaService:

    @staticmethod
    def _resolve_docker_host(host: str) -> str:
        if host in ['localhost', '127.0.0.1']:
            return 'host.docker.internal'
        return host

    @staticmethod
    def _build_connection_string(
        db_type: DBType,
        host: str,
        port: int,
        username: str,
        password: str,
        db_name: str
    ) -> str:
        resolved_host = SchemaService._resolve_docker_host(host)

        if db_type == DBType.POSTGRES:
            return (
                f"postgresql://{username}:{password}@"
                f"{resolved_host}:{port}/{db_name}"
            )
        elif db_type == DBType.MYSQL:
            return (
                f"mysql+pymysql://{username}:{password}@"
                f"{resolved_host}:{port}/{db_name}"
            )
        else:
            raise ValueError(f"Unsupported database type: {db_type}")

    @staticmethod
    def _extract_column_info(column_info: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "name": column_info["name"],
            "type": str(column_info["type"]),
        }
        if column_info.get("nullable", True):
            result["nullable"] = True
        if column_info.get("default") is not None:
            result["default"] = str(column_info["default"])
        return result

    @staticmethod
    def _inspect_schema(engine: Engine) -> Dict[str, List[Dict[str, Any]]]:
        inspector = inspect(engine)
        schema_data = {}

        try:
            table_names = inspector.get_table_names()
            logger.info(f"Found {len(table_names)} tables")

            for table_name in table_names:
                columns = []
                raw_columns = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                pk_columns = set(pk_constraint.get("constrained_columns", []))
                fk_constraints = inspector.get_foreign_keys(table_name)
                fk_map = {}
                for fk in fk_constraints:
                    for col, ref_col in zip(
                        fk.get("constrained_columns", []),
                        fk.get("referred_columns", [])
                    ):
                        ref_table = fk.get("referred_table", "")
                        fk_map[col] = f"{ref_table}.{ref_col}"

                for col_info in raw_columns:
                    col_data = SchemaService._extract_column_info(col_info)
                    col_name = col_data["name"]
                    if col_name in pk_columns:
                        col_data["pk"] = True
                    if col_name in fk_map:
                        col_data["fk"] = fk_map[col_name]
                    columns.append(col_data)

                schema_data[table_name] = columns
                logger.debug(
                    f"Extracted schema for '{table_name}': "
                    f"{len(columns)} columns"
                )
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
        try:
            connection = await connection_repository.get(db, id=connection_id)
            if not connection:
                raise ValueError(
                    f"Connection {connection_id} not found"
                )

            if connection.metadata_cache and not force:
                logger.info(
                    f"Using cached schema for {connection_id}"
                )
                return {
                    "success": True,
                    "message": "Using cached schema metadata",
                    "tables_count": len(connection.metadata_cache),
                    "schema": connection.metadata_cache
                }

            try:
                plain_password = decrypt_password(connection.db_password)
            except Exception as e:
                raise ValueError(f"Failed to decrypt password: {str(e)}")

            conn_string = SchemaService._build_connection_string(
                db_type=connection.db_type,
                host=connection.host,
                port=connection.port,
                username=connection.username,
                password=plain_password,
                db_name=connection.db_name
            )

            logger.info(
                f"Connecting to: "
                f"{connection.host}:{connection.port}/{connection.db_name}"
            )
            temp_engine = create_engine(
                conn_string,
                pool_pre_ping=True,
                pool_recycle=3600,
                connect_args={"connect_timeout": 10}
            )

            try:
                with temp_engine.connect():
                    logger.info("Connected successfully")

                schema_data = SchemaService._inspect_schema(temp_engine)
                connection.metadata_cache = schema_data
                await db.commit()
                await db.refresh(connection)

                logger.info(
                    "Synced schema for {}: "
                    "{} tables".format(connection_id, len(schema_data))
                )

                return {
                    "success": True,
                    "message": "Schema metadata synced successfully",
                    "tables_count": len(schema_data),
                    "schema": schema_data
                }
            finally:
                temp_engine.dispose()
                logger.debug("Disposed engine")

        except ValueError as e:
            logger.error(f"Validation error: {str(e)}")
            return {"success": False, "message": str(e)}
        except SQLAlchemyError as e:
            logger.error(f"DB connection error: {str(e)}")
            return {
                "success": False,
                "message": f"Connect failed: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"success": False, "message": f"Unexpected error: {str(e)}"}

    @staticmethod
    async def get_cached_schema(
        connection_id: UUID,
        db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        connection = await connection_repository.get(db, id=connection_id)
        if not connection:
            return None
        return connection.metadata_cache
