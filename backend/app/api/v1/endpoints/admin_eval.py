"""
Admin Evaluation Runner API.
Per-database evaluation using Spider dataset — controlled from Admin UI.
"""
import asyncio
import json
import logging
import os
import re
import sqlite3
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.api.v1.endpoints.admin import require_admin
from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.session import get_db
from app.models.models import DBConnection, DBType, User, UserRole, ChatRole
from app.repositories.connection_repository import connection_repository
from app.repositories.user_repository import user_repository
from app.repositories.conversation_repository import conversation_repository
from app.repositories.query_log_repository import query_log_repository
from app.services.llm_service import llm_service
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Paths ─────────────────────────────────────────────────────────────────────
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent.parent  # → SQLTuner/
_ADMIN_EVAL_DIR = _PROJECT_ROOT / "evaluation" / "admin_eval"

# Global state for progress tracking
EVAL_PROGRESS: Dict[str, Dict[str, int]] = {}

def _get_spider_dir() -> str:
    return settings.SPIDER_DIR


def _get_eval_output_dir() -> Path:
    d = _ADMIN_EVAL_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class SpiderDBInfo(BaseModel):
    db_id: str
    question_count: int
    has_sqlite: bool
    schema_loaded: bool = False


class LoadSchemaRequest(BaseModel):
    db_id: str
    user_id: str


class RunEvalRequest(BaseModel):
    db_id: str
    user_id: str
    limit: Optional[int] = None  # None = all questions


class EvalStatusResponse(BaseModel):
    db_id: str
    has_results: bool
    total_evaluated: int = 0
    total_questions: int = 0


class UserAccountInfo(BaseModel):
    id: str
    email: str
    role: str


# ── Spider Data Helpers (from evaluation/run.py) ─────────────────────────────

def _load_spider_dev(spider_dir: str) -> List[Dict]:
    dev_path = Path(spider_dir) / "dev.json"
    if not dev_path.exists():
        raise FileNotFoundError(f"dev.json not found at: {dev_path}")
    with open(dev_path, encoding="utf-8") as f:
        return json.load(f)


def _load_spider_tables(spider_dir: str) -> Dict[str, Dict]:
    tables_path = Path(spider_dir) / "tables.json"
    if not tables_path.exists():
        raise FileNotFoundError(f"tables.json not found at: {tables_path}")
    with open(tables_path, encoding="utf-8") as f:
        tables_data = json.load(f)
    return {t["db_id"]: t for t in tables_data}


def _get_db_path(spider_dir: str, db_id: str) -> str:
    return str(Path(spider_dir) / "database" / db_id / f"{db_id}.sqlite")


def _build_meta_schema_from_spider(table_info: Dict, db_path: str) -> Dict:
    table_names = table_info.get("table_names_original", [])
    column_names = table_info.get("column_names_original", [])
    column_types = table_info.get("column_types", [])
    primary_keys = set(table_info.get("primary_keys", []))
    foreign_keys = table_info.get("foreign_keys", [])
    fk_map = {fk_col: ref_col for fk_col, ref_col in foreign_keys}

    def map_spider_type(t: str) -> str:
        t = t.lower() if t else "text"
        if t == "number": return "numeric"
        if t == "time": return "timestamp"
        if t == "boolean": return "boolean"
        return "text"

    table_columns: Dict[int, List] = defaultdict(list)
    for col_idx, (table_idx, col_name) in enumerate(column_names):
        if table_idx == -1:
            continue
        raw_type = column_types[col_idx] if col_idx < len(column_types) else "text"
        pg_type = map_spider_type(raw_type)
        table_columns[table_idx].append({
            "col_idx": col_idx, "name": col_name,
            "type": pg_type,
            "is_pk": col_idx in primary_keys, "is_fk": col_idx in fk_map,
        })

    sample_data_map: Dict[str, List] = {}
    try:
        conn = sqlite3.connect(db_path, timeout=5)
        conn.row_factory = sqlite3.Row
        for tname in table_names:
            try:
                cur = conn.execute(f'SELECT * FROM "{tname}" LIMIT 3')
                sample_data_map[tname] = [dict(r) for r in cur.fetchall()]
            except Exception:
                sample_data_map[tname] = []
        conn.close()
    except Exception:
        pass

    tables = []
    for t_idx, tname in enumerate(table_names):
        cols, fks = [], []
        for c in table_columns[t_idx]:
            cols.append({
                "name": c["name"], "type": c["type"], "data_type": c["type"],
                "is_nullable": not c["is_pk"], "is_pk": c["is_pk"],
            })
            if c["is_fk"]:
                ref_col_idx = fk_map[c["col_idx"]]
                ref_table_idx, ref_col_name = column_names[ref_col_idx]
                fks.append({
                    "column": c["name"],
                    "ref_table": table_names[ref_table_idx] if ref_table_idx < len(table_names) else "",
                    "ref_column": ref_col_name,
                })
        tables.append({
            "name": tname, "columns": cols,
            "foreign_keys": fks,
            "sample_data": sample_data_map.get(tname, []),
        })

    return {"tables": tables}


# ── Metrics (from evaluation/run.py) ──────────────────────────────────────────

async def _execution_accuracy_with_reason_sandbox(pred_sql, gold_sql, db, meta_schema):
    from app.services.postgres_sandbox_service import postgres_sandbox_service
    
    async def _execute(sql):
        try:
            res = await postgres_sandbox_service.execute(db, meta_schema, sql)
            rows = res.get("rows", [])
            normalized = sorted(
                [tuple(str(v) if v is not None else "" for v in row.values()) for row in rows]
            )
            return normalized, None
        except Exception as e:
            return None, str(e)

    pred_rows, pred_err = await _execute(pred_sql)
    gold_rows, gold_err = await _execute(gold_sql)

    if gold_err:
        return 0, f"gold_sql_error: {gold_err}"
    if pred_err:
        return 0, f"pred_sql_error: {pred_err}"
    if pred_rows == gold_rows:
        return 1, None
    if not pred_rows and gold_rows:
        return 0, "empty_result"
    if pred_rows and not gold_rows:
        return 0, "extra_result"
    if len(pred_rows) != len(gold_rows):
        return 0, f"row_count_mismatch (pred={len(pred_rows)}, gold={len(gold_rows)})"
    if pred_rows and gold_rows and len(pred_rows) == len(gold_rows) and len(pred_rows[0]) == len(gold_rows[0]):
        p = sorted([tuple(sorted(list(row))) for row in pred_rows])
        g = sorted([tuple(sorted(list(row))) for row in gold_rows])
        if p == g:
            return 1, "relaxed_match_col_order"
    return 0, "value_mismatch"


def _exact_match(pred_sql, gold_sql):
    if not pred_sql or not gold_sql:
        return 0
    try:
        import sqlglot
        from sqlglot import exp as sqlglot_exp
        p = sqlglot.transpile(pred_sql, read="sqlite", write="sqlite", identify=True, pretty=True)[0].lower()
        g = sqlglot.transpile(gold_sql, read="sqlite", write="sqlite", identify=True, pretty=True)[0].lower()
        if p == g:
            return 1
        p_parsed = sqlglot.parse_one(pred_sql, read="sqlite")
        g_parsed = sqlglot.parse_one(gold_sql, read="sqlite")
        try:
            p_opt = sqlglot.optimizer.optimize(p_parsed)
            g_opt = sqlglot.optimizer.optimize(g_parsed)
        except Exception:
            p_opt, g_opt = p_parsed, g_parsed
        p_tables = {t.name.lower() for t in p_opt.find_all(sqlglot_exp.Table)}
        g_tables = {t.name.lower() for t in g_opt.find_all(sqlglot_exp.Table)}
        p_cols = {c.name.lower() for c in p_opt.find_all(sqlglot_exp.Column)}
        g_cols = {c.name.lower() for c in g_opt.find_all(sqlglot_exp.Column)}
        if p_tables == g_tables and p_cols == g_cols:
            return 1
        return 0
    except Exception:
        return 0


def _schema_linkage(pred_sql, gold_sql, table_names, column_names):
    def extract(sql):
        sql_l = sql.lower()
        found = set()
        for n in table_names:
            if re.search(r'\b' + re.escape(n.lower()) + r'\b', sql_l):
                found.add(("table", n.lower()))
        for n in column_names:
            if n.lower() == "*":
                continue
            if re.search(r'\b' + re.escape(n.lower()) + r'\b', sql_l):
                found.add(("column", n.lower()))
        return found
    e_gold = extract(gold_sql)
    if not e_gold:
        return 1.0
    e_pred = extract(pred_sql)
    return len(e_gold & e_pred) / len(e_gold)


_KEYWORD_WEIGHTS = {
    "JOIN": 1.0, "LEFT JOIN": 1.0, "RIGHT JOIN": 1.0,
    "INNER JOIN": 1.0, "CROSS JOIN": 1.5,
    "GROUP BY": 0.5, "ORDER BY": 0.5, "HAVING": 1.0,
    "UNION": 2.0, "INTERSECT": 2.0, "EXCEPT": 2.0,
    "LIMIT": 0.3, "DISTINCT": 0.5,
    "COUNT": 0.3, "SUM": 0.3, "AVG": 0.3, "MAX": 0.3, "MIN": 0.3,
}


def _sql_complexity(sql):
    sql_upper = sql.upper()
    score = sum(
        len(re.findall(r'\b' + kw + r'\b', sql_upper)) * w
        for kw, w in _KEYWORD_WEIGHTS.items()
    )
    nested = len(re.findall(r'\bSELECT\b', sql_upper)) - 1
    if nested > 0:
        score += nested * 3.0
    if score <= 1.0:
        return score, "easy"
    elif score <= 3.0:
        return score, "medium"
    elif score <= 6.0:
        return score, "hard"
    return score, "extra_hard"


def _extract_sql_from_llm(text: str) -> Optional[str]:
    """
    Robust SQL extraction from LLM responses.
    Handles: ```sql blocks, ``` blocks, raw SQL, SQL embedded in text.
    """
    if not text or not text.strip():
        return None

    # 1. Try ```sql ... ``` block first
    match = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        sql = match.group(1).strip()
        if sql:
            return sql

    # 2. Try any ``` ... ``` block that looks like SQL
    match = re.search(r"```\w*\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        candidate = match.group(1).strip()
        if re.match(r"^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)\b", candidate, re.IGNORECASE):
            return candidate

    # 3. Try to find SQL statement anywhere in the text
    # Look for SELECT/WITH at the beginning of a line and capture until ; or end
    sql_pattern = r"(?:^|\n)\s*((?:SELECT|WITH)\b[^;]*;?)"
    match = re.search(sql_pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        sql = match.group(1).strip()
        # Clean trailing non-SQL text (e.g. explanations after the query)
        # Stop at double newline followed by non-SQL text
        parts = re.split(r"\n\s*\n(?=[A-Z][a-z]|This |Note |The |Here )", sql, maxsplit=1)
        sql = parts[0].strip()
        # Remove trailing incomplete words after semicolon
        if ";" in sql:
            sql = sql[:sql.rindex(";") + 1]
        if sql:
            return sql

    # 4. If the entire text looks like SQL (no markdown, no explanation)
    stripped = text.strip()
    # Remove leading/trailing quotes if present
    if stripped.startswith('"') and stripped.endswith('"'):
        stripped = stripped[1:-1].strip()
    if re.match(r"^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)\b", stripped, re.IGNORECASE):
        # Take everything up to first semicolon or end
        if ";" in stripped:
            stripped = stripped[:stripped.index(";") + 1]
        return stripped

    logger.warning("[ADMIN_EVAL] Could not extract SQL from LLM response: %s", text[:200])
    return None


def _format_schema_for_prompt(meta_schema: Dict) -> str:
    lines = []
    for table in meta_schema.get("tables", []):
        cols = ", ".join(c["name"] for c in table["columns"])
        fks = table.get("foreign_keys", [])
        fk_str = ""
        if fks:
            fk_str = " | FK: " + ", ".join(
                f"{fk['column']}→{fk['ref_table']}.{fk['ref_column']}" for fk in fks
            )
        lines.append(f"- {table['name']}({cols}){fk_str}")
    return "\n".join(lines)


# ── Aggregation ───────────────────────────────────────────────────────────────

def _aggregate(results, errors):
    total = len(results)
    if total == 0:
        return {"total_evaluated": 0, "errors": errors}
    em_scores = [r.get("em", 0) for r in results]
    ex_scores = [r.get("ex", 0) for r in results]
    sl_scores = [r.get("sl", 0.0) for r in results]
    sl_linkage_scores = [r.get("sl_linkage", 0.0) for r in results]
    latencies = [r.get("latency_s", 0) for r in results]
    by_hardness: Dict[str, List] = defaultdict(list)
    for r in results:
        by_hardness[r["hardness"]].append(r)

    return {
        "timestamp": datetime.now().isoformat(),
        "total_evaluated": total,
        "total_errors": len(errors),
        "overall": {
            "EM (%)": round(sum(em_scores) / total * 100, 2),
            "EX (%)": round(sum(ex_scores) / total * 100, 2),
            "SL (Soft Label %)": round(sum(sl_scores) / total * 100, 2),
            "SL_Linkage (%)": round(sum(sl_linkage_scores) / total * 100, 2),
            "avg_latency_s": round(sum(latencies) / total, 3),
        },
        "by_hardness": {
            h: {
                "count": len(g),
                "em": round(sum(r["em"] for r in g) / len(g) * 100, 2),
                "ex": round(sum(r["ex"] for r in g) / len(g) * 100, 2),
                "sl": round(sum(r["sl"] for r in g) / len(g) * 100, 2),
            }
            for h, g in by_hardness.items()
        },
        "detailed_results": results,
        "errors": errors,
        "failed_cases": [
            {
                "db_id": r["db_id"], "question": r["question"],
                "gold_sql": r["gold_sql"], "pred_sql": r["pred_sql"],
                "sl": r["sl"], "error": r.get("error"),
            }
            for r in results if r["ex"] == 0
        ][:20],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/progress/{db_id}")
async def get_eval_progress(db_id: str, admin: User = Depends(require_admin)):
    prog = EVAL_PROGRESS.get(db_id)
    if prog:
        return prog
    return {"current": 0, "total": 0}

@router.get("/spider-databases", response_model=List[SpiderDBInfo])
async def list_spider_databases(
    admin: User = Depends(require_admin),
):
    """List all database directories in the configured Spider dataset path."""
    spider_dir = _get_spider_dir()
    db_dir = Path(spider_dir) / "database"

    if not Path(spider_dir).is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spider directory not found: {spider_dir}",
        )
    if not db_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spider database directory not found: {db_dir}",
        )

    # Load dev.json to count questions per database
    try:
        dev_data = _load_spider_dev(spider_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    question_counts: Dict[str, int] = defaultdict(int)
    for item in dev_data:
        question_counts[item["db_id"]] += 1

    results = []
    for entry in sorted(db_dir.iterdir()):
        if entry.is_dir():
            db_id = entry.name
            sqlite_path = entry / f"{db_id}.sqlite"
            results.append(SpiderDBInfo(
                db_id=db_id,
                question_count=question_counts.get(db_id, 0),
                has_sqlite=sqlite_path.exists(),
            ))

    return results


@router.get("/users-for-eval", response_model=List[UserAccountInfo])
async def list_users_for_eval(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all active users for evaluation account selection."""
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.email)
    )
    users = result.scalars().all()
    return [
        UserAccountInfo(id=str(u.id), email=u.email, role=u.role.value)
        for u in users
    ]


@router.post("/ensure-eval-user", response_model=UserAccountInfo)
async def ensure_eval_user(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create eval@gmail.com if it doesn't exist, return the user."""
    email = "eval@gmail.com"
    user = await user_repository.get_by_email(db, email=email)
    if not user:
        user = await user_repository.create(db, obj_in={
            "email": email,
            "password": get_password_hash("eval123"),
            "role": UserRole.USER,
            "is_active": True,
            "auth_provider": "email",
        })
        logger.info("[ADMIN_EVAL] Created eval user: %s", email)
    return UserAccountInfo(id=str(user.id), email=user.email, role=user.role.value)


@router.post("/load-schema")
async def load_schema_for_db(
    req: LoadSchemaRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Load Spider schema for a specific database into a SIMULATION connection.
    Creates connection if not exists, updates meta_schema.
    """
    spider_dir = _get_spider_dir()

    try:
        tables_map = _load_spider_tables(spider_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    table_info = tables_map.get(req.db_id)
    if not table_info:
        raise HTTPException(status_code=404, detail=f"No table info for db_id: {req.db_id}")

    db_path = _get_db_path(spider_dir, req.db_id)
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail=f"SQLite file not found: {db_path}")

    meta_schema = _build_meta_schema_from_spider(table_info, db_path)

    # Find or create a SIMULATION connection for this user + db_id
    from uuid import UUID as PyUUID
    user_id = PyUUID(req.user_id)
    conn_name = f"spider_eval_{req.db_id}"

    existing = await db.execute(
        select(DBConnection).where(
            DBConnection.user_id == user_id,
            DBConnection.name == conn_name,
        )
    )
    connection = existing.scalar_one_or_none()

    if connection:
        connection.meta_schema = meta_schema
        await db.commit()
        await db.refresh(connection)
    else:
        connection = DBConnection(
            user_id=user_id,
            name=conn_name,
            db_type=DBType.SIMULATION,
            meta_schema=meta_schema,
        )
        db.add(connection)
        await db.commit()
        await db.refresh(connection)

    table_count = len(meta_schema.get("tables", []))
    return {
        "status": "ok",
        "db_id": req.db_id,
        "connection_id": str(connection.id),
        "tables_loaded": table_count,
        "meta_schema": meta_schema,
    }


@router.post("/run-evaluation")
async def run_evaluation_for_db(
    req: RunEvalRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Run evaluation for a specific Spider database.
    Sends questions to the LLM, compares with gold SQL, saves results.
    """
    spider_dir = _get_spider_dir()

    try:
        dev_data = _load_spider_dev(spider_dir)
        tables_map = _load_spider_tables(spider_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Filter for this specific database
    db_questions = [d for d in dev_data if d["db_id"] == req.db_id]
    if not db_questions:
        raise HTTPException(status_code=404, detail=f"No questions found for db_id: {req.db_id}")

    # Apply limit
    if req.limit and req.limit > 0:
        db_questions = db_questions[:req.limit]

    table_info = tables_map.get(req.db_id, {})
    db_path = _get_db_path(spider_dir, req.db_id)

    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail=f"SQLite file not found: {db_path}")

    meta_schema = _build_meta_schema_from_spider(table_info, db_path)
    schema_text = _format_schema_for_prompt(meta_schema)

    table_names = table_info.get("table_names_original", [])
    column_names_list = [c for _, c in table_info.get("column_names_original", [])]

    system_prompt = (
        "You are an expert SQL assistant. Generate ONLY the SQL query.\n"
        "Database type: SQLite\n"
        f"Schema:\n{schema_text}\n\n"
        "Rules:\n"
        "- Output ONLY the SQL query inside ```sql ... ``` block\n"
        "- Use exact table and column names from the schema\n"
        "- No explanations, no comments"
    )

    results, errors = [], []

    from uuid import UUID as PyUUID
    from datetime import timezone

    user_id_uuid = PyUUID(req.user_id)
    conn_name = f"spider_eval_{req.db_id}"

    existing_conn = await db.execute(
        select(DBConnection).where(
            DBConnection.user_id == user_id_uuid,
            DBConnection.name == conn_name,
        )
    )
    connection = existing_conn.scalar_one_or_none()
    
    conversation_id = None
    if connection:
        conv = await conversation_repository.create(
            db,
            obj_in={
                "connection_id": connection.id,
                "title": f"Eval: {req.db_id} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            }
        )
        conversation_id = conv.id

    EVAL_PROGRESS[req.db_id] = {"current": 0, "total": len(db_questions)}

    for i, item in enumerate(db_questions):
        EVAL_PROGRESS[req.db_id]["current"] = i + 1
        question = item["question"]
        gold_sql = item["query"]
        hardness = item.get("query_complexity", "unknown")

        logger.info("[ADMIN_EVAL] [%d/%d] %s: %s", i + 1, len(db_questions), req.db_id, question[:60])

        if conversation_id:
            await query_log_repository.create(
                db,
                obj_in={
                    "conversation_id": conversation_id,
                    "role": ChatRole.USER,
                    "content": question,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            if connection:
                await db.refresh(connection)

        t0 = time.time()
        llm_response = None
        pred_sql = None
        try:
            from app.api.v1.endpoints.chat import _handle_chat_mode
            from app.schemas.sql import ChatCompletionRequest
            
            # Prevent hitting Groq's 30 RPM limit by adding a 5s delay between requests
            await asyncio.sleep(5)

            req_obj = ChatCompletionRequest(
                connection_id=connection.id,
                conversation_id=conversation_id,
                message=question,
                chat_mode="chat"
            )

            chat_resp = await _handle_chat_mode(req_obj, connection, conversation_id, db)
            pred_sql = chat_resp.sql_generated
            llm_response = chat_resp.content
        except Exception as e:
            logger.error("[ADMIN_EVAL] LLM error: %s", e)
            pred_sql = None
            llm_response = str(e)
        latency = time.time() - t0

        complexity_score, computed_hardness = _sql_complexity(gold_sql)
        final_hardness = hardness if hardness != "unknown" else computed_hardness

        if not pred_sql:
            results.append({
                "db_id": req.db_id, "question": question,
                "gold_sql": gold_sql, "pred_sql": None,
                "em": 0, "ex": 0, "sl": 0.0, "sl_linkage": 0.0,
                "hardness": final_hardness, "complexity_score": complexity_score,
                "latency_s": latency, "error": "no_sql_generated",
                "llm_raw": (llm_response or "")[:500],
            })
            continue

        ex_score, ex_reason = await _execution_accuracy_with_reason_sandbox(pred_sql, gold_sql, db, meta_schema)
        em_score = _exact_match(pred_sql, gold_sql)
        sl_linkage = _schema_linkage(pred_sql, gold_sql, table_names, column_names_list)

        sl_score = 1.0 if (ex_score == 1 or em_score == 1) else 0.0
        if sl_score == 0.0 and sl_linkage > 0.8:
            sl_score = sl_linkage

        results.append({
            "db_id": req.db_id, "question": question,
            "gold_sql": gold_sql, "pred_sql": pred_sql,
            "em": em_score, "ex": ex_score, "sl": sl_score,
            "sl_linkage": sl_linkage,
            "hardness": final_hardness, "complexity_score": complexity_score,
            "latency_s": latency, "error": ex_reason,
        })

    # Aggregate and save
    report = _aggregate(results, errors)
    report["config"] = {
        "spider_dir": spider_dir,
        "db_id": req.db_id,
        "limit": req.limit,
        "mode": "api",
        "llm_model": None,
    }

    output_dir = _get_eval_output_dir()
    output_path = output_dir / f"{req.db_id}_eval_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("[ADMIN_EVAL] Results saved to: %s", output_path)
    return report


@router.get("/results/{db_id}")
async def get_eval_results(
    db_id: str,
    admin: User = Depends(require_admin),
):
    """Read saved evaluation results for a specific database."""
    output_dir = _get_eval_output_dir()
    result_path = output_dir / f"{db_id}_eval_results.json"

    if not result_path.exists():
        raise HTTPException(status_code=404, detail=f"No results found for {db_id}")

    with open(result_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/results-status")
async def get_all_eval_status(
    admin: User = Depends(require_admin),
):
    """Get evaluation status for all databases (which have results)."""
    output_dir = _get_eval_output_dir()
    statuses = {}
    if output_dir.exists():
        for f in output_dir.glob("*_eval_results.json"):
            db_id = f.name.replace("_eval_results.json", "")
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                statuses[db_id] = {
                    "has_results": True,
                    "total_evaluated": data.get("total_evaluated", 0),
                    "timestamp": data.get("timestamp", ""),
                    "overall": data.get("overall", {}),
                }
            except Exception:
                statuses[db_id] = {"has_results": False}
    return statuses
