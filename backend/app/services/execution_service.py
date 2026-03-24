import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import sqlparse
from app.core.exceptions import ExecutionError, ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "columns": self.columns,
            "rows": self.rows,
            "row_count": self.row_count,
        }


class StatementParser:
    @staticmethod
    def parse_sql_query(sql_query: str) -> List[str]:
        statements = sqlparse.split(sql_query)
        statements = [
            stmt.strip() for stmt in statements
            if stmt.strip() and stmt.strip() != ";"
        ]

        if not statements:
            raise ValidationError("No valid SQL statements found")

        return statements


class ErrorClassifier:
    @staticmethod
    def is_duplicate_index_error(error_str: str, statement: str) -> bool:
        is_create_index = "CREATE INDEX" in statement.upper()
        if not is_create_index:
            return False

        duplicate_indicators = [
            "Duplicate key name" in error_str,
            "already exists" in error_str,
            "duplicate key" in error_str.lower(),
            "index" in statement.upper() and "already" in error_str.lower(),
        ]

        return any(duplicate_indicators)


class PostgresToSQLiteTypeMapper:
    _TEXT_TYPES = {
        "UUID",
        "JSONB",
        "JSON",
        "TIMESTAMPTZ",
        "TIMESTAMP WITH TIME ZONE",
        "TIMESTAMP WITHOUT TIME ZONE",
        "TIMESTAMP",
        "TEXT",
    }

    _INTEGER_TYPES = {"SERIAL", "BIGSERIAL", "SMALLSERIAL", "BOOLEAN", "BOOL"}

    _INTEGER_KEYWORDS = ["INT", "INTEGER", "BIGINT", "SMALLINT"]

    _REAL_KEYWORDS = ["FLOAT", "DOUBLE", "REAL", "NUMERIC", "DECIMAL"]

    @classmethod
    def map_type(cls, pg_type: str) -> str:
        pg_type_upper = pg_type.upper().strip()

        if any(t in pg_type_upper for t in ["UUID", "JSON", "TIMESTAMP"]):
            return "TEXT"

        if pg_type_upper in cls._TEXT_TYPES:
            return "TEXT"

        if "ARRAY" in pg_type_upper or pg_type_upper.startswith("_"):
            return "TEXT"

        if pg_type_upper in cls._INTEGER_TYPES:
            return "INTEGER"

        if any(keyword in pg_type_upper for keyword in cls._INTEGER_KEYWORDS):
            return "INTEGER"

        if any(keyword in pg_type_upper for keyword in cls._REAL_KEYWORDS):
            return "REAL"

        if "VARCHAR" in pg_type_upper or "CHAR" in pg_type_upper:
            return pg_type

        return pg_type


class ValueSanitizer:
    @staticmethod
    def sanitize_for_sqlite(value: Any, data_type: str) -> str:
        if value is None:
            return "NULL"

        if data_type == "TEXT":
            return ValueSanitizer._sanitize_text_value(value)

        if data_type in ("INTEGER", "REAL"):
            return ValueSanitizer._sanitize_numeric_value(value)

        return ValueSanitizer._escape_and_quote(str(value))

    @staticmethod
    def _sanitize_text_value(value: Any) -> str:
        if isinstance(value, (dict, list)):
            escaped = json.dumps(value).replace("'", "''")
            return f"'{escaped}'"
        return ValueSanitizer._escape_and_quote(str(value))

    @staticmethod
    def _sanitize_numeric_value(value: Any) -> str:
        if isinstance(value, bool):
            return "1" if value else "0"
        return str(value)

    @staticmethod
    def _escape_and_quote(value: str) -> str:
        return f"'{value.replace(chr(39), chr(39) + chr(39))}'"


class StatementExecutor:
    def __init__(self, log_prefix: str = "EXECUTE"):
        self.log_prefix = log_prefix

    def execute_statements(
        self, conn: Connection, sql_query: str
    ) -> ExecutionResult:
        statements = StatementParser.parse_sql_query(sql_query)
        logger.info(
            f"[{self.log_prefix}] Split into {len(statements)} statements"
        )

        final_columns = []
        final_rows = []

        for i, stmt in enumerate(statements):
            self._log_statement_execution(i + 1, stmt)

            try:
                result = self._execute_single_statement(conn, stmt, i + 1)
                if result:
                    final_columns, final_rows = result

            except Exception as stmt_error:
                if not self._handle_execution_error(
                    stmt_error, stmt, i + 1, conn
                ):
                    raise

        return ExecutionResult(
            columns=final_columns, rows=final_rows, row_count=len(final_rows)
        )

    def _execute_single_statement(
        self, conn: Connection, stmt: str, stmt_num: int
    ) -> Optional[tuple[List[str], List[Dict[str, Any]]]]:
        result = conn.execute(text(stmt))

        if result.returns_rows:
            columns = list(result.keys())
            rows = [dict(row._mapping) for row in result.fetchall()]
            logger.debug(
                f"[{self.log_prefix}] Statement {stmt_num} "
                f"returned {len(rows)} rows"
            )
            conn.commit()
            return columns, rows
        else:
            conn.commit()
            logger.debug(
                f"[{self.log_prefix}] Stmt {stmt_num} executed (no rows)"
            )
            return None

    def _handle_execution_error(
        self, error: Exception, stmt: str, stmt_num: int, conn: Connection
    ) -> bool:
        error_str = str(error)

        if ErrorClassifier.is_duplicate_index_error(error_str, stmt):
            logger.warning(
                f"[{self.log_prefix}] Statement {stmt_num} skipped: "
                "Index already exists"
            )
            conn.rollback()
            return True

        logger.error(
            f"[{self.log_prefix}] Statement {stmt_num} failed: {error_str}"
        )
        raise ExecutionError(f"Statement {stmt_num} failed: {error_str}")

    def _log_statement_execution(
        self, stmt_num: int, stmt: str
    ) -> None:
        logger.debug(
            f"[{self.log_prefix}] Executing statement {stmt_num}: "
            f"{stmt[:100]}..."
        )


class TableSchemaBuilder:
    @staticmethod
    def create_table(
        conn: Connection, table_name: str, columns: List[Dict[str, Any]]
    ) -> None:
        if not table_name or not columns:
            logger.warning(
                f"[SANDBOX] Skipping table creation: "
                f"table_name={table_name}, "
                f"columns_count={len(columns) if columns else 0}"
            )
            return

        logger.info(
            f"[SANDBOX] Creating '{table_name}' with {len(columns)} cols"
        )

        for idx, col in enumerate(columns):
            if not isinstance(col, dict):
                raise ValidationError(
                    f"Column {idx} in table '{table_name}' is not a "
                    f"dict: {type(col)}"
                )
            if 'name' not in col:
                raise ValidationError(
                    f"Column {idx} in table '{table_name}' missing "
                    f"'name' field"
                )

        col_defs, primary_keys = TableSchemaBuilder._build_column_definitions(
            columns
        )

        if primary_keys:
            pk_constraint = TableSchemaBuilder._build_primary_key_constraint(
                primary_keys
            )
            col_defs.append(pk_constraint)

        create_stmt = TableSchemaBuilder._build_create_statement(
            table_name, col_defs
        )
        logger.debug(f"[SANDBOX] SQL: {create_stmt}")

        conn.execute(text(create_stmt))
        conn.commit()

        col_names = [col.get("name") for col in columns]
        logger.info(f"[SANDBOX] '{table_name}' created with {col_names}")

    @staticmethod
    def _build_column_definitions(
        columns: List[Dict[str, Any]]
    ) -> tuple[List[str], List[str]]:
        col_defs = []
        primary_keys = []

        for col in columns:
            col_name = col.get("name")
            pg_type = col.get("type", "TEXT")
            nullable = col.get("is_nullable", True)
            is_pk = col.get("is_pk", False)

            sqlite_type = PostgresToSQLiteTypeMapper.map_type(pg_type)
            col_def = f'"{col_name}" {sqlite_type}'

            if not nullable:
                col_def += " NOT NULL"

            if is_pk:
                primary_keys.append(col_name)

            col_defs.append(col_def)

        return col_defs, primary_keys

    @staticmethod
    def _build_primary_key_constraint(primary_keys: List[str]) -> str:
        pk_cols = ", ".join(f'"{pk}"' for pk in primary_keys)
        return f"PRIMARY KEY ({pk_cols})"

    @staticmethod
    def _build_create_statement(table_name: str, col_defs: List[str]) -> str:
        col_defs_str = ",\n  ".join(col_defs)
        return f'CREATE TABLE "{table_name}" (\n  {col_defs_str}\n);'


class DataSeeder:
    @staticmethod
    def seed_table_data(
        conn: Connection,
        table_name: str,
        columns: List[Dict[str, Any]],
        rows: List[Dict[str, Any]],
    ) -> int:
        if not rows:
            logger.debug(f"[SANDBOX] No sample data for '{table_name}'")
            return 0

        logger.info(f"[SANDBOX] Seeding {len(rows)} rows into '{table_name}'")

        type_map = DataSeeder._build_type_map(columns)

        for row in rows:
            DataSeeder._insert_row(conn, table_name, row, type_map)

        conn.commit()
        logger.info(f"[SANDBOX] Seeded {len(rows)} rows into '{table_name}'")

        return len(rows)

    @staticmethod
    def _build_type_map(columns: List[Dict[str, Any]]) -> Dict[str, str]:
        type_map = {}
        for col in columns:
            col_name = col.get("name")
            pg_type = col.get("type", "TEXT")
            type_map[col_name] = PostgresToSQLiteTypeMapper.map_type(pg_type)
        return type_map

    @staticmethod
    def _insert_row(
        conn: Connection,
        table_name: str,
        row: Dict[str, Any],
        type_map: Dict[str, str],
    ) -> None:
        columns_list = list(row.keys())
        values_list = [
            ValueSanitizer.sanitize_for_sqlite(
                row[col], type_map.get(col, "TEXT")
            )
            for col in columns_list
        ]

        cols_str = ", ".join(
            f'"{c}"' for c in columns_list
        )
        vals_str = ", ".join(values_list)
        # Use INSERT OR IGNORE to skip duplicate rows
        insert_stmt = (
            f'INSERT OR IGNORE INTO "{table_name}" '
            f'({cols_str}) VALUES ({vals_str});'
        )

        conn.execute(text(insert_stmt))


class SimulationExecutor:
    @staticmethod
    def execute_in_sandbox(
        conn: Connection, sql_query: str
    ) -> ExecutionResult:
        executor = StatementExecutor(log_prefix="EXECUTE")
        return executor.execute_statements(conn, sql_query)

    @staticmethod
    def execute_in_real_db(
        conn: Connection, sql_query: str
    ) -> ExecutionResult:
        executor = StatementExecutor(log_prefix="REAL_DB")
        return executor.execute_statements(conn, sql_query)

    def execute(
        self,
        meta_schema: Dict[str, Any],
        sql_query: str,
        sample_data: Optional[Dict[str, List[Dict]]] = None,
    ) -> Dict[str, Any]:
        logger.info(
            f"[SANDBOX] Starting execution with query: "
            f"{sql_query[:100]}..."
        )
        logger.debug(f"[SANDBOX] meta_schema type: {type(meta_schema)}")
        if isinstance(meta_schema, dict):
            logger.debug(
                f"[SANDBOX] meta_schema keys: {list(meta_schema.keys())}"
            )

        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            echo=False,
        )

        try:
            with engine.connect() as conn:
                tables = meta_schema.get("tables", [])
                logger.info(
                    f"[SANDBOX] Creating {len(tables)} tables in sandbox"
                )

                if not tables:
                    logger.warning("[SANDBOX] No tables found in meta_schema")

                # Create tables
                for table in tables:
                    table_name = table.get("name")
                    columns = table.get("columns", [])
                    TableSchemaBuilder.create_table(conn, table_name, columns)

                # Seed data
                total_seeded_rows = 0
                for table in tables:
                    table_name = table.get("name")
                    rows = table.get("sample_data", [])

                    if not rows and sample_data:
                        rows = sample_data.get(table_name, [])

                    total_seeded_rows += DataSeeder.seed_table_data(
                        conn, table_name, table.get("columns", []), rows
                    )

                logger.info(
                    f"[SANDBOX] Total seeded rows: {total_seeded_rows}"
                )

                # Execute query
                result = self.execute_in_sandbox(conn, sql_query)
                return result.to_dict()

        finally:
            engine.dispose()


simulation_executor = SimulationExecutor()
