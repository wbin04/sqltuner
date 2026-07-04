# backend/app/services/postgres_sandbox_service.py
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


class PostgresSandboxService:
    """
    Chạy sandbox query trực tiếp trên PostgreSQL thật
    thay vì SQLite in-memory.
    """

    def _get_sandbox_engine(self):
        """Lấy sync engine để chạy DDL/DML trong sandbox."""
        # Dùng sync engine (psycopg2) vì sandbox không cần async
        db_url = settings.SQLALCHEMY_DATABASE_URL.replace(
            "postgresql+asyncpg://", "postgresql://"
        )
        from sqlalchemy import create_engine
        return create_engine(db_url, isolation_level="AUTOCOMMIT")

    @asynccontextmanager
    async def sandbox_schema(self, db: AsyncSession, schema_name: str):
        """
        Context manager tự động CREATE và DROP SCHEMA.
        Dùng async session của app (để không cần open connection riêng).
        """
        try:
            await db.execute(
                text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
            )
            await db.commit()
            logger.info(f"[SANDBOX] Created schema: {schema_name}")
            yield schema_name
        finally:
            # Ngăn ngừa InFailedSQLTransactionError ghi đè lỗi thực sự 
            # của EXPLAIN query gây ra transaction bị aborted. 
            await db.rollback()
            try:
                await db.execute(
                    text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                )
                await db.commit()
                logger.info(f"[SANDBOX] Dropped schema: {schema_name}")
            except Exception as e:
                logger.error(f"[SANDBOX] Error dropping schema: {e}")

    async def execute(
        self,
        db: AsyncSession,
        meta_schema: Dict[str, Any],
        sql_query: str,
    ) -> Dict[str, Any]:
        schema_name = f"sandbox_{uuid.uuid4().hex[:12]}"

        async with self.sandbox_schema(db, schema_name):
            # Set search_path cho session này
            await db.execute(
                text(f'SET search_path TO "{schema_name}", public')
            )

            tables = meta_schema.get("tables", [])

            # 1. Tạo bảng (DDL gốc, không cần convert type)
            for table in tables:
                ddl_statements = self._build_create_table(schema_name, table)
                for stmt in ddl_statements:
                    await db.execute(text(stmt))

            # 2. Seed data
            for table in tables:
                await self._seed_data(db, schema_name, table)

            await db.commit()

            # 3. Chạy query thật. Cần set lại search_path vì commit có thể reset state
            await db.execute(text(f'SET search_path TO "{schema_name}", public'))
            result = await db.execute(text(sql_query))
            
            if result.returns_rows:
                columns = list(result.keys())
                rows = [dict(row._mapping) for row in result.fetchall()]
                return {
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                }
            return {"columns": [], "rows": [], "row_count": 0}

    async def explain_analyze(
        self,
        db: AsyncSession,
        meta_schema: Dict[str, Any],
        sql_query: str,
    ) -> Dict[str, Any]:
        """
        Chạy EXPLAIN (ANALYZE, FORMAT JSON) và trả về plan JSON thật
        từ PostgreSQL planner.
        """
        schema_name = f"sandbox_{uuid.uuid4().hex[:12]}"

        async with self.sandbox_schema(db, schema_name):
            await db.execute(
                text(f'SET search_path TO "{schema_name}", public')
            )

            tables = meta_schema.get("tables", [])
            for table in tables:
                ddl_statements = self._build_create_table(schema_name, table)
                for stmt in ddl_statements:
                    await db.execute(text(stmt))
            for table in tables:
                await self._seed_data(db, schema_name, table)
            await db.commit()

            # Set lại search_path vì commit có thể mất state do connection pool event
            await db.execute(text(f'SET search_path TO "{schema_name}", public'))
            # EXPLAIN thường
            explain_sql = f"EXPLAIN {sql_query}"
            explain_result = await db.execute(text(explain_sql))
            explain_plan = [{"QUERY PLAN": row[0]} for row in explain_result.fetchall()]

            # EXPLAIN ANALYZE
            analyze_sql = f"EXPLAIN ANALYZE {sql_query}"
            analyze_result = await db.execute(text(analyze_sql))
            analyze_plan = [{"QUERY PLAN": row[0]} for row in analyze_result.fetchall()]

            return {
                "explain_rows": explain_plan,
                "analyze_rows": analyze_plan
            }

    def _build_create_table(self, schema_name: str, table: Dict) -> List[str]:
        # Dùng lowercase cho tên bảng/cột để PostgreSQL case-fold khớp với query AI
        # (AI generate SELECT Name → fold thành name → khớp với cột name)
        statements = []
        table_name = table["name"].lower()
        columns = table.get("columns", [])

        col_defs = []
        pk_cols = []

        for col in columns:
            col_name_lower = col["name"].lower()
            col_def = f'  {col_name_lower} {col["type"]}'
            if not col.get("is_nullable", True):
                col_def += " NOT NULL"
            if col.get("default") is not None:
                default_val = col['default']
                # Skip sequence defaults since sandbox doesn't create sequences
                if not (isinstance(default_val, str) and 'nextval' in default_val.lower()):
                    col_def += f" DEFAULT {default_val}"
            col_defs.append(col_def)
            if col.get("is_pk"):
                pk_cols.append(col_name_lower)

        if pk_cols:
            pk_str = ", ".join(pk_cols)
            col_defs.append(f"  PRIMARY KEY ({pk_str})")

        body = ",\n".join(col_defs)
        create_table_stmt = f'CREATE TABLE "{schema_name}".{table_name} (\n{body}\n)'
        statements.append(create_table_stmt)

        # Indexes
        for idx in table.get("indexes", []):
            idx_name = idx["name"].lower()
            idx_cols = ", ".join(c.lower() for c in idx["column_names"])
            unique = "UNIQUE " if idx.get("unique") else ""
            create_idx_stmt = (
                f'CREATE {unique}INDEX {idx_name} '
                f'ON "{schema_name}".{table_name} ({idx_cols})'
            )
            statements.append(create_idx_stmt)

        return statements

    async def _seed_data(
        self, db: AsyncSession, schema_name: str, table: Dict
    ) -> None:
        table_name = table["name"].lower()  # khớp với CREATE TABLE lowercase
        sample_data = table.get("sample_data", [])
        columns = table.get("columns", [])

        if not sample_data:
            return

        # col_types dùng lowercase key để khớp với sanitized_row key
        col_types = {col["name"].lower(): col["type"].upper() for col in columns}

        for row in sample_data:
            # Normalize row keys sang lowercase để khớp với tên cột trong DB
            lower_row = {k.lower(): v for k, v in row.items()}
            sanitized_row = self._sanitize_row_data(lower_row, col_types)
            cols_str = ", ".join(c for c in sanitized_row.keys())
            placeholders = ", ".join(
                self._cast_placeholder(col, col_types.get(col, "TEXT"))
                for col in sanitized_row.keys()
            )
            insert_sql = (
                f'INSERT INTO "{schema_name}"."{table_name}" '
                f"({cols_str}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING"
            )
            try:
                # Use SAVEPOINT so a single data type error doesn't abort the whole transaction
                async with db.begin_nested():
                    await db.execute(text(insert_sql), sanitized_row)
            except Exception as e:
                logger.debug(f"[SANDBOX] Seed row failed for table '{table_name}': {e}")

    def _sanitize_row_data(self, row: Dict[str, Any], col_types: Dict[str, str]) -> Dict[str, Any]:
        import json
        import uuid
        import hashlib
        
        sanitized = {}
        for col_name, value in row.items():
            pg_type = col_types.get(col_name, "TEXT")

            if value is None:
                sanitized[col_name] = None
                continue

            # Postgres strict type checking fails on empty string for numeric/boolean/uuid/date types
            if isinstance(value, str) and value.strip() == "":
                if any(t in pg_type for t in ["INT", "FLOAT", "NUMERIC", "DECIMAL", "REAL", "BOOL", "UUID", "TIMESTAMP", "DATE"]):
                    sanitized[col_name] = None
                    continue

            # For NUMERIC columns, sentinel strings like '?', 'null', 'N/A' (common in
            # Spider datasets for missing values) must become NULL — not cause a cast error.
            if any(t in pg_type for t in ["INT", "FLOAT", "NUMERIC", "DECIMAL", "REAL"]):
                if isinstance(value, str):
                    try:
                        float(value.strip())
                    except (ValueError, TypeError):
                        sanitized[col_name] = None
                        continue

            # Parse UUID
            if "UUID" in pg_type:
                val_str = str(value)
                try:
                    uuid_obj = uuid.UUID(val_str)
                    sanitized[col_name] = str(uuid_obj)
                except ValueError:
                    # Deterministic fallback to preserve relationship for invalid uuid string (e.g. "1")
                    m = hashlib.md5(val_str.encode("utf-8"))
                    sanitized[col_name] = str(uuid.UUID(m.hexdigest()))
                continue

            # Parse boolean
            if "BOOL" in pg_type:
                if isinstance(value, str):
                    val_upper = value.strip().upper()
                    if val_upper in ("1", "TRUE", "T", "YES", "Y"):
                        sanitized[col_name] = True
                    elif val_upper in ("0", "FALSE", "F", "NO", "N"):
                        sanitized[col_name] = False
                    else:
                        sanitized[col_name] = bool(value)
                else:
                    sanitized[col_name] = bool(value)
                continue

            # Parse JSON/dict
            if isinstance(value, (dict, list)):
                sanitized[col_name] = json.dumps(value)
                continue

            sanitized[col_name] = value

        return sanitized

    def _cast_placeholder(self, col_name: str, pg_type: str) -> str:
        """Tạo placeholder với type cast cho PostgreSQL chuẩn của SQLAlchemy."""
        if "UUID" in pg_type:
            return f"CAST(:{col_name} AS uuid)"
        if "JSONB" in pg_type or "JSON" in pg_type:
            return f"CAST(:{col_name} AS jsonb)"
        if "TIMESTAMP" in pg_type:
            return f"CAST(:{col_name} AS timestamp)"
        if "BOOL" in pg_type:
            return f"CAST(:{col_name} AS boolean)"
        return f":{col_name}"


postgres_sandbox_service = PostgresSandboxService()