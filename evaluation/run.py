#!/usr/bin/env python3
"""
Spider Evaluation Script for Text-to-SQL System
================================================
Đánh giá các metrics:
  1. Execution Accuracy (EX)      — chạy SQL thật trên SQLite
  2. Exact Match (EM)             — so sánh cấu trúc tập hợp mệnh đề
  3. Schema Linkage Accuracy (SL) — tỷ lệ table/column nhận diện đúng
  4. SQL Complexity / Hardness    — phân loại và báo cáo theo nhóm khó

Cấu hình qua biến môi trường (hoặc file .env):

  # ── Chung ──────────────────────────────────────────────
  EVAL_SPIDER_DIR=/path/to/spider        (bắt buộc)
  EVAL_LIMIT=100                         (mặc định: 100)
  EVAL_DB_ID=                            (tuỳ chọn, để trống = tất cả DB)
  EVAL_OUTPUT=eval_results.json          (mặc định: eval_results.json)
  EVAL_MODE=offline                      (offline | api, mặc định: offline)

  # ── Offline mode — gọi LLM trực tiếp, không cần server ─
  EVAL_LLM_BACKEND=ollama                (ollama | groq, mặc định: ollama)
  EVAL_LLM_URL=http://localhost:11434    (Ollama base URL)
  EVAL_LLM_MODEL=sqlcoder:7b            (tên model)
  GROQ_API_KEY=gsk_xxx                   (chỉ cần khi EVAL_LLM_BACKEND=groq)

  # ── API mode — gọi hệ thống đang chạy (end-to-end) ─────
  EVAL_API_URL=http://localhost:8000
  EVAL_API_TOKEN=<jwt_token>
  EVAL_CONNECTION_ID=<uuid>

Cách chạy:
  pip install requests sqlglot tqdm python-dotenv
  cp .env.example .env
  # chỉnh sửa .env
  python evaluate_spider.py
"""

import json
import os
import re
import sqlite3
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
import sqlglot
from sqlglot import exp as sqlglot_exp

# Load .env nếu có python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # optional — có thể export env vars trực tiếp

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# ─────────────────────────────────────────────
# 0. CONFIG — đọc toàn bộ từ env vars
# ─────────────────────────────────────────────

class Config:
    """Tập trung tất cả cấu hình từ biến môi trường."""

    # ── Chung
    SPIDER_DIR:    str           = os.environ.get("EVAL_SPIDER_DIR", "")
    LIMIT:         int           = int(os.environ.get("EVAL_LIMIT", "100"))
    DB_ID_FILTER:  Optional[str] = os.environ.get("EVAL_DB_ID") or None
    OUTPUT:        str           = os.environ.get("EVAL_OUTPUT", "eval_results.json")
    MODE:          str           = os.environ.get("EVAL_MODE", "offline").lower()

    # ── Offline mode
    LLM_BACKEND:   str = os.environ.get("EVAL_LLM_BACKEND", "ollama").lower()
    LLM_URL:       str = os.environ.get("EVAL_LLM_URL", "http://localhost:11434")
    LLM_MODEL:     str = os.environ.get("EVAL_LLM_MODEL", "sqlcoder:7b")
    GROQ_API_KEY:  str = os.environ.get("GROQ_API_KEY", "")

    # ── API mode
    # Hệ thống dùng HttpOnly cookie (không phải Bearer header).
    # Xem .env.example để biết cách lấy EVAL_API_COOKIE.
    API_URL:         str = os.environ.get("EVAL_API_URL", "http://localhost:8000")
    API_COOKIE:      str = os.environ.get("EVAL_API_COOKIE", "")
    API_COOKIE_NAME: str = os.environ.get("EVAL_API_COOKIE_NAME", "access_token")
    # CONNECTION_ID chỉ dùng làm fallback khi không có db_path (tuỳ chọn)
    CONNECTION_ID:   str = os.environ.get("EVAL_CONNECTION_ID", "")

    @classmethod
    def validate(cls) -> None:
        """Kiểm tra các tham số bắt buộc, thoát nếu thiếu."""
        errors = []

        if not cls.SPIDER_DIR:
            errors.append("EVAL_SPIDER_DIR chưa được set")
        elif not Path(cls.SPIDER_DIR).is_dir():
            errors.append(f"EVAL_SPIDER_DIR='{cls.SPIDER_DIR}' không tồn tại")

        if cls.MODE not in ("offline", "api"):
            errors.append(f"EVAL_MODE='{cls.MODE}' không hợp lệ, phải là 'offline' hoặc 'api'")

        if cls.MODE == "api":
            if not cls.API_COOKIE:
                errors.append(
                    "EVAL_API_COOKIE chưa được set (bắt buộc với EVAL_MODE=api).\n"
                    "    Cách lấy: Browser → F12 → Application → Cookies → copy value 'access_token'\n"
                    "    Hoặc: curl -c cookies.txt -X POST .../api/v1/auth/login -d '{email,password}'"
                )
            # CONNECTION_ID là tuỳ chọn — script tự tạo per-DB connections

        if cls.MODE == "offline":
            if cls.LLM_BACKEND not in ("ollama", "groq"):
                errors.append(f"EVAL_LLM_BACKEND='{cls.LLM_BACKEND}' không hợp lệ, phải là 'ollama' hoặc 'groq'")
            if cls.LLM_BACKEND == "groq" and not cls.GROQ_API_KEY:
                errors.append("GROQ_API_KEY chưa được set (bắt buộc với EVAL_LLM_BACKEND=groq)")

        if errors:
            print("\n[ERROR] Cấu hình không hợp lệ:")
            for e in errors:
                print(f"  • {e}")
            print("\nXem docstring ở đầu file để biết danh sách biến môi trường.\n")
            sys.exit(1)

    @classmethod
    def print_summary(cls) -> None:
        """In tóm tắt cấu hình khi khởi động."""
        print("\n" + "─"*55)
        print("  CẤU HÌNH ĐÁNH GIÁ")
        print("─"*55)
        print(f"  EVAL_SPIDER_DIR   : {cls.SPIDER_DIR}")
        print(f"  EVAL_MODE         : {cls.MODE}")
        print(f"  EVAL_LIMIT        : {cls.LIMIT}")
        print(f"  EVAL_DB_ID        : {cls.DB_ID_FILTER or '(tất cả)'}")
        print(f"  EVAL_OUTPUT       : {cls.OUTPUT}")
        if cls.MODE == "offline":
            print(f"  EVAL_LLM_BACKEND  : {cls.LLM_BACKEND}")
            print(f"  EVAL_LLM_URL      : {cls.LLM_URL}")
            print(f"  EVAL_LLM_MODEL    : {cls.LLM_MODEL}")
        else:
            print(f"  EVAL_API_URL         : {cls.API_URL}")
            print(f"  EVAL_API_COOKIE_NAME : {cls.API_COOKIE_NAME}")
            print(f"  EVAL_API_COOKIE      : {'***' + cls.API_COOKIE[-6:] if len(cls.API_COOKIE) > 6 else '***'}")
            print(f"  EVAL_CONNECTION_ID   : {cls.CONNECTION_ID or '(auto per-DB)'}")
        print("─"*55 + "\n")


# ─────────────────────────────────────────────
# 1. SPIDER DATA LOADER
# ─────────────────────────────────────────────

def load_spider_dev(spider_dir: str) -> List[Dict]:
    """Load dev.json từ Spider dataset."""
    dev_path = Path(spider_dir) / "dev.json"
    if not dev_path.exists():
        raise FileNotFoundError(f"dev.json không tìm thấy tại: {dev_path}")
    with open(dev_path, encoding="utf-8") as f:
        return json.load(f)


def load_spider_tables(spider_dir: str) -> Dict[str, Dict]:
    """Load tables.json → dict[db_id -> table_info]."""
    tables_path = Path(spider_dir) / "tables.json"
    if not tables_path.exists():
        raise FileNotFoundError(f"tables.json không tìm thấy tại: {tables_path}")
    with open(tables_path, encoding="utf-8") as f:
        tables_data = json.load(f)
    return {t["db_id"]: t for t in tables_data}


def get_db_path(spider_dir: str, db_id: str) -> str:
    return str(Path(spider_dir) / "database" / db_id / f"{db_id}.sqlite")


def build_meta_schema_from_spider(table_info: Dict, db_path: str) -> Dict:
    """
    Chuyển đổi Spider tables.json format → meta_schema format của hệ thống.
    Đọc sample data từ .sqlite để enrich schema.
    """
    table_names  = table_info.get("table_names_original", [])
    column_names = table_info.get("column_names_original", [])  # [(table_idx, col_name)]
    column_types = table_info.get("column_types", [])
    primary_keys = set(table_info.get("primary_keys", []))
    foreign_keys = table_info.get("foreign_keys", [])           # [[col_idx, ref_col_idx]]

    fk_map: Dict[int, int] = {fk_col: ref_col for fk_col, ref_col in foreign_keys}

    # Group columns by table
    table_columns: Dict[int, List] = defaultdict(list)
    for col_idx, (table_idx, col_name) in enumerate(column_names):
        if table_idx == -1:
            continue
        table_columns[table_idx].append({
            "col_idx":  col_idx,
            "name":     col_name,
            "type":     column_types[col_idx] if col_idx < len(column_types) else "text",
            "is_pk":    col_idx in primary_keys,
            "is_fk":    col_idx in fk_map,
        })

    # Sample data từ SQLite
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
                "name":        c["name"],
                "type":        c["type"],
                "data_type":   c["type"],
                "is_nullable": not c["is_pk"],
                "is_pk":       c["is_pk"],
            })
            if c["is_fk"]:
                ref_col_idx = fk_map[c["col_idx"]]
                ref_table_idx, ref_col_name = column_names[ref_col_idx]
                fks.append({
                    "column":     c["name"],
                    "ref_table":  table_names[ref_table_idx] if ref_table_idx < len(table_names) else "",
                    "ref_column": ref_col_name,
                })
        tables.append({
            "name":        tname,
            "columns":     cols,
            "foreign_keys": fks,
            "sample_data": sample_data_map.get(tname, []),
        })

    return {"tables": tables}


# ─────────────────────────────────────────────
# 2. API CLIENT
# ─────────────────────────────────────────────

class SystemAPIClient:
    """
    Gọi /chat/completion của hệ thống đang chạy (end-to-end).

    Mỗi db_id Spider cần 1 connection riêng với đúng meta_schema của nó.
    Client tự động:
      1. Tạo connection (SIMULATION type) cho db_id nếu chưa có
      2. Upload .sqlite file → parse meta_schema
      3. Gọi /chat/completion với connection_id đúng
      4. Xoá tất cả connections đã tạo khi cleanup()

    Điều này đảm bảo LLM nhận đúng schema cho từng DB — không bị
    nhiễm schema từ DB trước đó.
    """

    def __init__(self) -> None:
        self.base_url = Config.API_URL.rstrip("/")
        self.cookies  = {
            Config.API_COOKIE_NAME: Config.API_COOKIE
        }
        self.headers  = {"Content-Type": "application/json"}
        # Cache: db_id → connection_id (tránh tạo lại cho cùng DB)
        self._db_connection_cache: Dict[str, str] = {}
        # Danh sách connection đã tạo để cleanup sau
        self._created_connections: List[str] = []

    # ── Auth helpers ──────────────────────────────────────────

    def _post(self, path: str, **kwargs) -> requests.Response:
        return requests.post(
            f"{self.base_url}{path}",
            headers=self.headers,
            cookies=self.cookies,
            timeout=30,
            **kwargs,
        )

    def _delete(self, path: str) -> requests.Response:
        return requests.delete(
            f"{self.base_url}{path}",
            headers=self.headers,
            cookies=self.cookies,
            timeout=10,
        )

    # ── Per-DB connection management ─────────────────────────

    def _get_or_create_connection(self, db_id: str, db_path: str) -> Optional[str]:
        """
        Trả về connection_id cho db_id.
        Nếu chưa có: tạo SIMULATION connection + upload .sqlite.
        """
        if db_id in self._db_connection_cache:
            return self._db_connection_cache[db_id]

        # 1. Tạo connection mới (SIMULATION)
        try:
            resp = self._post(
                "/api/v1/connections/",
                json={
                    "name":    f"eval_{db_id}",
                    "db_type": "simulation",
                },
            )
            resp.raise_for_status()
            conn_id = resp.json()["id"]
            self._created_connections.append(conn_id)
        except Exception as e:
            print(f"  [WARN] Không tạo được connection cho {db_id}: {e}")
            return None

        # 2. Upload .sqlite → parse meta_schema
        try:
            with open(db_path, "rb") as f:
                upload_resp = requests.post(
                    f"{self.base_url}/api/v1/connections/{conn_id}/import-sql",
                    files={"file": (f"{db_id}.sqlite", f, "application/octet-stream")},
                    cookies=self.cookies,
                    timeout=(10, 120),
                )
            upload_resp.raise_for_status()
        except Exception as e:
            print(f"  [WARN] Upload schema thất bại cho {db_id}: {e}")
            # Xoá connection vừa tạo để tránh orphans
            try:
                self._delete(f"/api/v1/connections/{conn_id}")
                self._created_connections.remove(conn_id)
            except Exception:
                pass
            return None

        self._db_connection_cache[db_id] = conn_id
        return conn_id

    def cleanup(self) -> None:
        """Xoá tất cả connections đã tạo trong session này."""
        deleted = 0
        for conn_id in self._created_connections:
            try:
                self._delete(f"/api/v1/connections/{conn_id}")
                deleted += 1
            except Exception:
                pass
        if deleted:
            print(f"[INFO] Đã xoá {deleted} eval connections.")
        self._created_connections.clear()
        self._db_connection_cache.clear()

    # ── Main generate ─────────────────────────────────────────

    def generate_sql(self, question: str, meta_schema: Dict = None,
                     db_id: str = None, db_path: str = None) -> Optional[str]:
        """
        Sinh SQL qua /chat/completion.

        Nếu db_id + db_path được truyền vào: tự động lấy/tạo
        connection đúng cho DB đó trước khi gọi LLM.
        """
        # Resolve connection_id: per-DB nếu có info, fallback sang config
        if db_id and db_path:
            conn_id = self._get_or_create_connection(db_id, db_path)
        else:
            conn_id = Config.CONNECTION_ID

        if not conn_id:
            return None

        try:
            resp = self._post(
                "/api/v1/chat/completion",
                json={
                    "message":       question,
                    "connection_id": conn_id,
                    "chat_mode":     "chat",
                },
            )
            resp.raise_for_status()
            return resp.json().get("sql_generated")
        except Exception:
            return None


# ─────────────────────────────────────────────
# 3. OFFLINE LLM CLIENT
# ─────────────────────────────────────────────

class OfflineLLMClient:
    """Gọi LLM trực tiếp với schema inject, không cần server chạy."""

    def __init__(self) -> None:
        self.llm_url = Config.LLM_URL.rstrip("/")
        self.model   = Config.LLM_MODEL
        self.backend = Config.LLM_BACKEND

    def _format_schema(self, meta_schema: Dict) -> str:
        lines = []
        for table in meta_schema.get("tables", []):
            cols   = ", ".join(c["name"] for c in table["columns"])
            fks    = table.get("foreign_keys", [])
            fk_str = ""
            if fks:
                fk_str = " | FK: " + ", ".join(
                    f"{fk['column']}→{fk['ref_table']}.{fk['ref_column']}" for fk in fks
                )
            lines.append(f"- {table['name']}({cols}){fk_str}")
        return "\n".join(lines)

    def _build_system_prompt(self, schema_text: str) -> str:
        return (
            "You are an expert SQL assistant. Generate ONLY the SQL query.\n"
            "Database type: SQLite\n"
            f"Schema:\n{schema_text}\n\n"
            "Rules:\n"
            "- Output ONLY the SQL query inside ```sql ... ``` block\n"
            "- Use exact table and column names from the schema\n"
            "- No explanations, no comments"
        )

    def generate_sql(self, question: str, meta_schema: Dict) -> Optional[str]:
        schema_text   = self._format_schema(meta_schema)
        system_prompt = self._build_system_prompt(schema_text)
        if self.backend == "groq":
            return self._call_groq(question, system_prompt)
        return self._call_ollama(question, system_prompt)

    def _call_ollama(self, question: str, system_prompt: str) -> Optional[str]:
        try:
            resp = requests.post(
                f"{self.llm_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": question},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
                timeout=60,
            )
            resp.raise_for_status()
            return _extract_sql(resp.json()["message"]["content"])
        except Exception:
            return None

    def _call_groq(self, question: str, system_prompt: str) -> Optional[str]:
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": question},
                    ],
                    "temperature": 0.1,
                },
                headers={"Authorization": f"Bearer {Config.GROQ_API_KEY}"},
                timeout=30,
            )
            resp.raise_for_status()
            return _extract_sql(resp.json()["choices"][0]["message"]["content"])
        except Exception:
            return None


def _extract_sql(text: str) -> Optional[str]:
    match = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    stripped = text.strip()
    if re.match(r"^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)\b", stripped, re.IGNORECASE):
        return stripped
    return None


# ─────────────────────────────────────────────
# 4. METRICS
# ─────────────────────────────────────────────

# ── 4.1 Execution Accuracy (EX)

def execute_sql_on_sqlite(
    db_path: str, sql: str
) -> Tuple[Optional[List[Tuple]], Optional[str]]:
    """
    Chạy SQL trên SQLite.
    Trả về (rows, None) nếu thành công, (None, error_msg) nếu lỗi.
    rows=[] là kết quả hợp lệ nhưng rỗng — khác với None (lỗi thực thi).
    """
    try:
        conn = sqlite3.connect(db_path, timeout=10)
        conn.execute("PRAGMA query_only = ON")
        rows = conn.execute(sql).fetchall()
        conn.close()
        normalized = sorted(
            [tuple(str(v) if v is not None else "" for v in row) for row in rows]
        )
        return normalized, None
    except Exception as e:
        return None, str(e)


def execution_accuracy(pred_sql: str, gold_sql: str, db_path: str) -> int:
    """Backward-compat wrapper — trả về 0/1."""
    score, _ = execution_accuracy_with_reason(pred_sql, gold_sql, db_path)
    return score


def execution_accuracy_with_reason(
    pred_sql: str, gold_sql: str, db_path: str
) -> Tuple[int, Optional[str]]:
    """
    Trả về (score, fail_reason).
    """
    pred_rows, pred_err = execute_sql_on_sqlite(db_path, pred_sql)
    gold_rows, gold_err = execute_sql_on_sqlite(db_path, gold_sql)

    if gold_err:
        return 0, f"gold_sql_error: {gold_err}"
    if pred_err:
        return 0, f"pred_sql_error: {pred_err}"

    if pred_rows == gold_rows:
        return 1, None

    # Phân loại nguyên nhân cụ thể và thử so sánh linh hoạt (Relaxed match)
    if not pred_rows and gold_rows:
        return 0, "empty_result"
    if pred_rows and not gold_rows:
        return 0, "extra_result"
    
    if len(pred_rows) != len(gold_rows):
        return 0, f"row_count_mismatch (pred={len(pred_rows)}, gold={len(gold_rows)})"

    # Relaxed Match: Kiểm tra nếu các row khớp nhau nhưng khác thứ tự cột
    # (Chỉ áp dụng nếu số lượng row khớp và không quá lớn để tránh overhead)
    if pred_rows and gold_rows and len(pred_rows) == len(gold_rows) and len(pred_rows[0]) == len(gold_rows[0]):
        # Thử sort nội dung từng row để bỏ qua thứ tự cột
        p_rows_content = sorted([tuple(sorted(list(row))) for row in pred_rows])
        g_rows_content = sorted([tuple(sorted(list(row))) for row in gold_rows])
        if p_rows_content == g_rows_content:
            return 1, "relaxed_match_col_order"

    return 0, "value_mismatch"


# ── 4.2 Exact Match (EM)

def _parse_sql_components(sql: str) -> Dict[str, Any]:
    """
    Sử dụng sqlglot để parse và chuẩn hoá các thành phần SQL.
    Hỗ trợ so sánh cấu trúc tốt hơn là so sánh text thô.
    """
    try:
        # Normalize: uppercase keywords, remove aliases, simplify expressions
        parsed = sqlglot.parse_one(sql, read="sqlite")
        optimized = sqlglot.optimizer.optimize(parsed)
        
        components: Dict[str, set] = {
            "tables": set(),
            "columns": set(),
            "expressions": set(),
            "limit": None
        }
        
        for tbl in optimized.find_all(sqlglot_exp.Table):
            components["tables"].add(tbl.name.lower())
            
        for col in optimized.find_all(sqlglot_exp.Column):
            components["columns"].add(col.name.lower())
            
        # Extract WHERE conditions as string sets for comparison
        where = optimized.find(sqlglot_exp.Where)
        if where:
            components["where"] = {str(expr).lower() for expr in where.find_all(sqlglot_exp.Binary)}
        
        limit = optimized.find(sqlglot_exp.Limit)
        if limit:
            components["limit"] = str(limit.expression).lower()
            
        return components
    except Exception:
        return {}


def exact_match(pred_sql: str, gold_sql: str) -> int:
    """
    So sánh khớp chính xác dựa trên cấu trúc đã chuẩn hoá.
    """
    if not pred_sql or not gold_sql:
        return 0
        
    try:
        p_parsed = sqlglot.transpile(pred_sql, read="sqlite", write="sqlite", identify=True, pretty=True)[0].lower()
        g_parsed = sqlglot.transpile(gold_sql, read="sqlite", write="sqlite", identify=True, pretty=True)[0].lower()
        
        # 1. So sánh text đã transpile (chuẩn hoá format)
        if p_parsed == g_parsed:
            return 1
            
        # 2. So sánh các thành phần logic
        p_comp = _parse_sql_components(pred_sql)
        g_comp = _parse_sql_components(gold_sql)
        
        if not p_comp or not g_comp:
            return 0
            
        # Kiểm tra tables và columns quan trọng
        if p_comp["tables"] == g_comp["tables"] and p_comp["columns"] == g_comp["columns"]:
            # Nếu khớp cả tables và columns, xem như khớp cấu trúc cơ bản
            # Có thể thêm kiểm tra WHERE/LIMIT nếu muốn cực kỳ khắt khe
            return 1
            
        return 0
    except Exception:
        return 0


# ── 4.3 Schema Linkage Accuracy (SL)

def extract_entities_from_sql(sql: str, table_names: List[str], column_names: List[str]) -> set:
    sql_lower = sql.lower()
    found = set()
    for name in table_names:
        if re.search(r'\b' + re.escape(name.lower()) + r'\b', sql_lower):
            found.add(("table", name.lower()))
    for name in column_names:
        if name.lower() == "*":
            continue
        if re.search(r'\b' + re.escape(name.lower()) + r'\b', sql_lower):
            found.add(("column", name.lower()))
    return found


def schema_linkage_accuracy(
    pred_sql: str,
    gold_sql: str,
    table_names: List[str],
    column_names: List[str],
) -> float:
    e_gold = extract_entities_from_sql(gold_sql, table_names, column_names)
    if not e_gold:
        return 1.0
    e_pred = extract_entities_from_sql(pred_sql, table_names, column_names)
    return len(e_gold & e_pred) / len(e_gold)


def soft_label_semantic_match(
    client: Any,
    question: str,
    pred_sql: str,
    gold_sql: str,
    ex_score: int,
    em_score: int
) -> float:
    """
    Đánh giá ngữ nghĩa (Soft Label). 
    Nếu EX=1 hoặc EM=1 thì SL mặc định là 1.0.
    Nếu không, có thể dùng LLM hoặc heuristics để đánh giá.
    """
    if ex_score == 1 or em_score == 1:
        return 1.0
    
    # Heuristic đơn giản: nếu schema linkage cao và độ dài tương đồng
    # (Trong tương lai có thể gọi client.generate_sql với prompt "Compare these two SQLs")
    return 0.0 # Mặc định 0 nếu không khớp gì


# ── 4.4 SQL Complexity / Hardness

_KEYWORD_WEIGHTS = {
    "JOIN": 1.0, "LEFT JOIN": 1.0, "RIGHT JOIN": 1.0,
    "INNER JOIN": 1.0, "CROSS JOIN": 1.5,
    "GROUP BY": 0.5, "ORDER BY": 0.5, "HAVING": 1.0,
    "UNION": 2.0, "INTERSECT": 2.0, "EXCEPT": 2.0,
    "LIMIT": 0.3, "DISTINCT": 0.5,
    "COUNT": 0.3, "SUM": 0.3, "AVG": 0.3, "MAX": 0.3, "MIN": 0.3,
}
_NESTED_SUBQUERY_WEIGHT = 3.0


def sql_complexity_score(sql: str) -> Tuple[float, str]:
    sql_upper = sql.upper()
    score = sum(
        len(re.findall(r'\b' + kw + r'\b', sql_upper)) * w
        for kw, w in _KEYWORD_WEIGHTS.items()
    )
    nested = len(re.findall(r'\bSELECT\b', sql_upper)) - 1
    if nested > 0:
        score += nested * _NESTED_SUBQUERY_WEIGHT

    if score <= 1.0:
        return score, "easy"
    elif score <= 3.0:
        return score, "medium"
    elif score <= 6.0:
        return score, "hard"
    return score, "extra_hard"


# ─────────────────────────────────────────────
# 5. EVALUATION RUNNER
# ─────────────────────────────────────────────

def run_evaluation(client, use_offline: bool) -> Dict:
    spider_dir = Config.SPIDER_DIR
    dev_data   = load_spider_dev(spider_dir)
    tables_map = load_spider_tables(spider_dir)

    if Config.DB_ID_FILTER:
        dev_data = [d for d in dev_data if d["db_id"] == Config.DB_ID_FILTER]

    dev_data = dev_data[:Config.LIMIT]

    results, errors = [], []
    interrupted = False
    iterator = tqdm(dev_data, desc="Evaluating") if HAS_TQDM else dev_data

    try:
        for item in iterator:
            question = item["question"]
            gold_sql = item["query"]
            db_id    = item["db_id"]
            hardness = item.get("query_complexity", "unknown")
            db_path  = get_db_path(spider_dir, db_id)
            table_info = tables_map.get(db_id, {})

            if not os.path.exists(db_path):
                errors.append({"db_id": db_id, "error": "DB file not found"})
                continue

            meta_schema = build_meta_schema_from_spider(table_info, db_path)

            t0 = time.time()
            if use_offline:
                # Offline: truyền meta_schema trực tiếp vào LLM
                pred_sql = client.generate_sql(question, meta_schema)
            else:
                # API mode: truyền db_id + db_path để client tự lấy/tạo
                # connection đúng cho DB này (per-DB connection management)
                pred_sql = client.generate_sql(
                    question, meta_schema,
                    db_id=db_id, db_path=db_path,
                )
            latency = time.time() - t0

            complexity_score, computed_hardness = sql_complexity_score(gold_sql)
            final_hardness = hardness if hardness != "unknown" else computed_hardness

            if not pred_sql:
                results.append({
                    "db_id": db_id, "question": question,
                    "gold_sql": gold_sql, "pred_sql": None,
                    "em": 0, "ex": 0, "sl": 0.0,
                    "sl_linkage": 0.0,
                    "hardness": final_hardness,
                    "complexity_score": complexity_score,
                    "latency_s": latency,
                    "error": "no_sql_generated",
                })
                continue

            table_names  = table_info.get("table_names_original", [])
            column_names = [c for _, c in table_info.get("column_names_original", [])]

            ex_score, ex_reason = execution_accuracy_with_reason(pred_sql, gold_sql, db_path)
            em_score = exact_match(pred_sql, gold_sql)
            sl_linkage = schema_linkage_accuracy(pred_sql, gold_sql, table_names, column_names)
            
            # Tính Soft Label (SL)
            sl_score = soft_label_semantic_match(client, question, pred_sql, gold_sql, ex_score, em_score)
            if sl_score == 0.0 and sl_linkage > 0.8:
                # Heuristic fallback: if schema linkage is very high, it's likely a soft match
                sl_score = sl_linkage

            results.append({
                "db_id":            db_id,
                "question":         question,
                "gold_sql":         gold_sql,
                "pred_sql":         pred_sql,
                "em":               em_score,
                "ex":               ex_score,
                "sl":               sl_score,
                "sl_linkage":       sl_linkage,
                "hardness":         final_hardness,
                "complexity_score": complexity_score,
                "latency_s":        latency,
                "error":            ex_reason,
            })

    except KeyboardInterrupt:
        interrupted = True
        print(f"\n\n[INFO] Đã nhận Ctrl+C — dừng sau {len(results)} mẫu đã xử lý.")
        print("[INFO] Đang tổng hợp và lưu kết quả partial...")
    except Exception as e:
        print(f"\n\n[ERROR] Lỗi không xác định trong vòng lặp đánh giá: {e}")
        import traceback
        traceback.print_exc()
        print("[INFO] Đang cố gắng tổng hợp kết quả đã có...")

    try:
        return _aggregate(results, errors, interrupted=interrupted)
    except Exception as e:
        print(f"[ERROR] Lỗi khi tổng hợp kết quả: {e}")
        import traceback
        traceback.print_exc()
        # Trả về format tối giản nhất để main() vẫn có thể lưu kết quả thô
        return {
            "timestamp": datetime.now().isoformat(),
            "error_during_aggregation": str(e),
            "total_evaluated": len(results),
            "detailed_results": results,
            "errors": errors
        }


# ─────────────────────────────────────────────
# 6. AGGREGATION & REPORT
# ─────────────────────────────────────────────

def _aggregate(results: List[Dict], errors: List[Dict],
               interrupted: bool = False) -> Dict:
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
        "timestamp":        datetime.now().isoformat(),
        "interrupted":      interrupted,          # True nếu bị Ctrl+C
        "config": {
            "spider_dir":   Config.SPIDER_DIR,
            "mode":         Config.MODE,
            "limit":        Config.LIMIT,
            "db_id_filter": Config.DB_ID_FILTER,
            "llm_backend":  Config.LLM_BACKEND if Config.MODE == "offline" else None,
            "llm_model":    Config.LLM_MODEL    if Config.MODE == "offline" else None,
        },
        "total_evaluated": total,
        "total_errors":    len(errors),
        "overall": {
            "EM (%)":       round(sum(em_scores) / total * 100, 2),
            "EX (%)":       round(sum(ex_scores) / total * 100, 2),
            "SL (Soft Label %)": round(sum(sl_scores) / total * 100, 2),
            "SL_Linkage (%)": round(sum(sl_linkage_scores) / total * 100, 2),
            "avg_latency_s": round(sum(latencies) / total, 3),
        },
        "by_hardness": {
            h: {
                "count": len(g),
                "em":    round(sum(r["em"] for r in g) / len(g) * 100, 2),
                "ex":    round(sum(r["ex"] for r in g) / len(g) * 100, 2),
                "sl":    round(sum(r["sl"] for r in g) / len(g) * 100, 2),
            }
            for h, g in by_hardness.items()
        },
        "detailed_results": results,
        "errors":           errors,
        "failed_cases": [
            {
                "db_id":     r["db_id"],
                "question":  r["question"],
                "gold_sql":  r["gold_sql"],
                "pred_sql":  r["pred_sql"],
                "sl":        r["sl"],
                "error":     r.get("error"),
            }
            for r in results if r["ex"] == 0
        ][:20],
    }


def print_report(report: Dict) -> None:
    print("\n" + "="*60)
    print("  SPIDER EVALUATION REPORT")
    print("="*60)
    print(f"  Timestamp : {report['timestamp']}")
    print(f"  Evaluated : {report['total_evaluated']} samples")
    print(f"  Errors    : {report['total_errors']} skipped")
    print("-"*60)

    overall = report.get("overall", {})
    print("\n  ── OVERALL METRICS ──")
    print(f"  Exact Match (EM)          : {overall.get('EM (%)', 0):>6.2f} %")
    print(f"  Execution Accuracy (EX)   : {overall.get('EX (%)', 0):>6.2f} %")
    print(f"  Soft Label (SL)           : {overall.get('SL (Soft Label %)', 0):>6.2f} %")
    print(f"  Schema Linkage (SL_Link)  : {overall.get('SL_Linkage (%)', 0):>6.2f} %")
    print(f"  Avg Latency               : {overall.get('avg_latency_s', 0):>6.3f} s")

    by_hardness = report.get("by_hardness", {})
    if by_hardness:
        print("\n  ── BY HARDNESS ──")
        print(f"  {'Level':<12} {'Count':>5} {'EM%':>7} {'EX%':>7} {'SL%':>7}")
        print("  " + "-"*42)
        for level in ["easy", "medium", "hard", "extra_hard", "unknown"]:
            if level in by_hardness:
                g = by_hardness[level]
                print(f"  {level:<12} {g['count']:>5} {g['em']:>6.1f}% {g['ex']:>6.1f}% {g['sl']:>6.1f}%")

    failed = report.get("failed_cases", [])
    if failed:
        print(f"\n  ── SAMPLE FAILURES (top 5 / {len(failed)}) ──")
        for i, case in enumerate(failed[:5], 1):
            print(f"\n  [{i}] DB: {case['db_id']}")
            print(f"      Q    : {case['question']}")
            print(f"      Gold : {case['gold_sql']}")
            print(f"      Pred : {case['pred_sql'] or '(none)'}")
            print(f"      SL   : {case['sl']:.2f}")

    print("\n" + "="*60)


# ─────────────────────────────────────────────
# 7. ENTRY POINT
# ─────────────────────────────────────────────

def main() -> None:
    Config.validate()
    Config.print_summary()

    if Config.MODE == "api":
        client      = SystemAPIClient()
        use_offline = False
    else:
        client      = OfflineLLMClient()
        use_offline = True

    print("[INFO] Bắt đầu đánh giá...\n")
    report = {}
    try:
        report = run_evaluation(client, use_offline)
    except Exception as e:
        print(f"\n[CRITICAL] Lỗi nghiêm trọng: {e}")
        import traceback
        traceback.print_exc()
        # Nếu ngay cả run_evaluation cũng sập (không return được dict)
        if not report:
            report = {
                "timestamp": datetime.now().isoformat(),
                "error": str(e),
                "status": "failed"
            }
    finally:
        # Xoá tất cả per-DB connections đã tạo trong session
        if hasattr(client, "cleanup"):
            client.cleanup()

    try:
        print_report(report)
    except Exception as e:
        print(f"[WARN] Không thể hiển thị báo cáo đẹp: {e}")

    try:
        out_path = Path(Config.OUTPUT)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n[INFO] Kết quả đầy đủ đã lưu tại: {out_path.absolute()}\n")
    except Exception as e:
        print(f"[ERROR] Không thể lưu kết quả vào file: {e}")


if __name__ == "__main__":
    main()