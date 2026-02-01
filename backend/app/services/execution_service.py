import json
from typing import Any, Dict, List, Optional

import sqlparse
from sqlalchemy import create_engine, text


class SimulationExecutor:

    @staticmethod
    def _execute_statements(conn, sql_query: str) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger(__name__)

        statements = sqlparse.split(sql_query)
        statements = [
            stmt.strip()
            for stmt in statements
            if stmt.strip() and stmt.strip() != ';'
        ]

        if not statements:
            raise ValueError("No valid SQL statements found")

        logger.info(f"[EXECUTE] Split into {len(statements)} statements")

        final_columns = []
        final_rows = []

        for i, stmt in enumerate(statements):
            logger.debug(
                f"[EXECUTE] Executing statement {i+1}: {stmt[:100]}...")

            try:
                result = conn.execute(text(stmt))

                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [dict(row._mapping) for row in result.fetchall()]
                    final_columns = columns
                    final_rows = rows
                    logger.debug(
                        f"[EXECUTE] Statement {i+1} returned {len(rows)} rows")
                else:
                    conn.commit()
                    logger.debug(
                        f"[EXECUTE] Stmt {i+1} executed (no rows)")

            except Exception as stmt_error:
                error_str = str(stmt_error)

                is_duplicate_index = (
                    "Duplicate key name" in error_str or
                    "already exists" in error_str or
                    "duplicate key" in error_str.lower() or
                    "index" in stmt.upper() and "already" in error_str.lower()
                )

                if is_duplicate_index and "CREATE INDEX" in stmt.upper():
                    logger.warning(
                        f"[EXECUTE] Statement {i+1} skipped:"
                        "Index already exists")
                    conn.rollback()
                    continue

                logger.error(f"[EXECUTE] Statement {i+1} failed: {error_str}")
                raise Exception(f"Statement {i+1} failed: {error_str}")

        return {
            "columns": final_columns,
            "rows": final_rows,
            "row_count": len(final_rows)
        }

    @staticmethod
    def execute_real_db_statements(conn, sql_query: str) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger(__name__)

        statements = sqlparse.split(sql_query)
        statements = [
            stmt.strip()
            for stmt in statements
            if stmt.strip() and stmt.strip() != ';'
        ]

        if not statements:
            raise ValueError("No valid SQL statements found")

        logger.info(f"[REAL_DB] Split into {len(statements)} statements")

        final_columns = []
        final_rows = []

        for i, stmt in enumerate(statements):
            logger.debug(
                f"[REAL_DB] Executing statement {i+1}: {stmt[:100]}...")

            try:
                result = conn.execute(text(stmt))

                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [dict(row._mapping) for row in result.fetchall()]
                    final_columns = columns
                    final_rows = rows
                    logger.debug(
                        f"[REAL_DB] Statement {i+1} returned {len(rows)} rows")
                else:
                    logger.debug(
                        f"[REAL_DB] Stmt {i+1} executed (no rows)")

            except Exception as stmt_error:
                error_str = str(stmt_error)

                is_duplicate_index = (
                    "Duplicate key name" in error_str or
                    "already exists" in error_str or
                    "duplicate key" in error_str.lower()
                )

                if is_duplicate_index and "CREATE INDEX" in stmt.upper():
                    logger.warning(
                        f"[REAL_DB] Stmt {i+1} skipped: Index exists")
                    conn.rollback()
                    continue

                logger.error(f"[REAL_DB] Statement {i+1} failed: {error_str}")
                raise Exception(f"Statement {i+1} failed: {error_str}")

        return {
            "columns": final_columns,
            "rows": final_rows,
            "row_count": len(final_rows)
        }

    @staticmethod
    def _map_postgres_to_sqlite(pg_type: str) -> str:
        pg_type_upper = pg_type.upper().strip()

        if 'UUID' in pg_type_upper:
            return 'TEXT'

        if pg_type_upper in ('JSONB', 'JSON'):
            return 'TEXT'

        if pg_type_upper in (
            'TIMESTAMPTZ',
            'TIMESTAMP WITH TIME ZONE',
            'TIMESTAMP WITHOUT TIME ZONE',
                'TIMESTAMP'):
            return 'TEXT'

        if 'ARRAY' in pg_type_upper or pg_type_upper.startswith('_'):
            return 'TEXT'

        if pg_type_upper in ('SERIAL', 'BIGSERIAL', 'SMALLSERIAL'):
            return 'INTEGER'

        if pg_type_upper in ('BOOLEAN', 'BOOL'):
            return 'INTEGER'

        if any(
            t in pg_type_upper for t in [
                'INT',
                'INTEGER',
                'BIGINT',
                'SMALLINT']):
            return 'INTEGER'

        if any(
            t in pg_type_upper for t in [
                'FLOAT',
                'DOUBLE',
                'REAL',
                'NUMERIC',
                'DECIMAL']):
            return 'REAL'

        if 'VARCHAR' in pg_type_upper or 'CHAR' in pg_type_upper:
            return pg_type

        if pg_type_upper == 'TEXT':
            return 'TEXT'

        return pg_type

    @staticmethod
    def _sanitize_value_for_sqlite(value: Any, data_type: str) -> str:
        if value is None:
            return 'NULL'

        if data_type == 'TEXT':
            if isinstance(value, dict) or isinstance(value, list):
                escaped = json.dumps(value).replace(chr(39), chr(39) + chr(39))
                return f"'{escaped}'"
            else:
                return f"'{str(value).replace(chr(39), chr(39) + chr(39))}'"

        if data_type in ('INTEGER', 'REAL'):
            if isinstance(value, bool):
                return '1' if value else '0'
            return str(value)

        return f"'{str(value).replace(chr(39), chr(39) + chr(39))}'"

    def execute(
        self,
        meta_schema: Dict[str, Any],
        sql_query: str,
        sample_data: Optional[Dict[str, List[Dict]]] = None
    ) -> Dict[str, Any]:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            echo=False
        )

        try:
            with engine.connect() as conn:
                tables = meta_schema.get('tables', [])

                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"[SANDBOX] Creating {len(tables)} tables in sandbox")

                for table in tables:
                    table_name = table.get('name')
                    columns = table.get('columns', [])

                    if not table_name or not columns:
                        continue

                    logger.info(
                        f"[SANDBOX] Creating '{table_name}' with {len(columns)} cols")  # noqa: E501

                    # Build column definitions
                    col_defs = []
                    primary_keys = []

                    for col in columns:
                        col_name = col.get('name')
                        pg_type = col.get('type', 'TEXT')
                        nullable = col.get('is_nullable', True)
                        is_pk = col.get('is_pk', False)

                        sqlite_type = self._map_postgres_to_sqlite(pg_type)

                        col_def = f'"{col_name}" {sqlite_type}'

                        if not nullable:
                            col_def += ' NOT NULL'

                        if is_pk:
                            primary_keys.append(col_name)

                        col_defs.append(col_def)

                    if primary_keys:
                        pk_cols = ", ".join(f'"{pk}"' for pk in primary_keys)
                        pk_constraint = f'PRIMARY KEY ({pk_cols})'
                        col_defs.append(pk_constraint)

                    col_defs_str = ",\n  ".join(col_defs)
                    create_stmt = (
                        f'CREATE TABLE "{table_name}" (\n  {col_defs_str}\n);'
                    )
                    logger.debug(f"[SANDBOX] SQL: {create_stmt}")
                    conn.execute(text(create_stmt))
                    conn.commit()

                    col_names = [col.get('name') for col in columns]
                    logger.info(
                        f"[SANDBOX] '{table_name}' created with {col_names}")

                total_seeded_rows = 0
                for table in tables:
                    table_name = table.get('name')
                    rows = table.get('sample_data', [])

                    if not rows and sample_data:
                        rows = sample_data.get(table_name, [])

                    if not rows:
                        logger.debug(
                            f"[SANDBOX] No sample data for '{table_name}'")
                        continue

                    logger.info(
                        f"[SANDBOX] Seeding {len(rows)} rows into '{table_name}'")  # noqa: E501

                    type_map = {}
                    for col in table.get('columns', []):
                        col_name = col.get('name')
                        pg_type = col.get('type', 'TEXT')
                        type_map[col_name] = self._map_postgres_to_sqlite(
                            pg_type)

                    for row in rows:
                        columns_list = list(row.keys())
                        values_list = [
                            self._sanitize_value_for_sqlite(
                                row[col], type_map.get(col, 'TEXT')
                            )
                            for col in columns_list
                        ]

                        cols_str = ", ".join(f'"{c}"' for c in columns_list)
                        vals_str = ", ".join(values_list)
                        insert_stmt = (
                            f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({vals_str});'  # noqa: E501
                        )
                        conn.execute(text(insert_stmt))
                        total_seeded_rows += 1

                    conn.commit()
                    logger.info(
                        f"[SANDBOX] Seeded {len(rows)} rows into '{table_name}'")  # noqa: E501

                logger.info(
                    f"[SANDBOX] Total seeded rows: {total_seeded_rows}")

                result = self._execute_statements(conn, sql_query)

                return result

        finally:
            engine.dispose()


simulation_executor = SimulationExecutor()
