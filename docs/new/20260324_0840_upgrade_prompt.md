# Task: Nâng cấp chức năng SQL Optimization cho SQLTuner

## Context

Đây là project SQLTuner — AI-powered SQL query optimization system. Stack:
- Backend: Python 3.10 + FastAPI
- LLM: Ollama (local) với `coder_model` (SQLCoder/Qwen) và `chat_model` (Llama3)
- DB nội bộ: PostgreSQL 17
- Frontend: React 18 + TypeScript + TailwindCSS

## Hiện trạng

Chức năng optimize hiện tại CHỈ tập trung vào gợi ý index (missing index detection).
Cần mở rộng để detect và fix nhiều loại SQL anti-pattern hơn.

---

## Danh sách thay đổi cần thực hiện

### 1. Tạo file mới: `backend/app/services/sql_analyzer.py`

File này thực hiện static analysis trên SQL AST (dùng sqlglot),
chạy TRƯỚC khi gọi LLM để gắn nhãn các anti-pattern cụ thể.

Nội dung cần implement:

~~~python
import re
from dataclasses import dataclass
from typing import List

import sqlglot
from sqlglot import exp


@dataclass
class SqlIssue:
    type: str        # loại anti-pattern
    severity: str    # "high" | "medium" | "low"
    message: str     # mô tả vấn đề
    suggestion: str  # gợi ý fix


class SqlAntiPatternDetector:
    """
    Static analysis trên SQL AST, không cần kết nối DB.
    Detect các anti-pattern phổ biến gây chậm query.
    """

    def detect(self, sql: str) -> List[SqlIssue]:
        issues = []
        try:
            parsed = sqlglot.parse_one(sql)
        except Exception:
            return issues

        issues += self._check_select_star(parsed)
        issues += self._check_in_subquery(parsed)
        issues += self._check_function_on_column(parsed)
        issues += self._check_leading_wildcard_like(parsed)
        issues += self._check_or_conditions(parsed)
        issues += self._check_implicit_type_conversion(parsed)
        issues += self._check_distinct_overuse(parsed)

        return issues

    def _check_select_star(self, parsed) -> List[SqlIssue]:
        # Detect SELECT * — fetch tất cả column kể cả không dùng
        stars = list(parsed.find_all(exp.Star))
        if stars:
            return [SqlIssue(
                type="select_star",
                severity="medium",
                message="SELECT * fetches all columns including unused ones, increasing I/O",
                suggestion="Specify only needed columns: SELECT id, name, email FROM ..."
            )]
        return []

    def _check_in_subquery(self, parsed) -> List[SqlIssue]:
        # Detect WHERE id IN (SELECT ...) — có thể gây N+1 scan
        issues = []
        for node in parsed.find_all(exp.In):
            if isinstance(node.args.get("query"), exp.Subquery):
                issues.append(SqlIssue(
                    type="in_subquery",
                    severity="high",
                    message="IN (SELECT ...) subquery can cause repeated full scans",
                    suggestion="Rewrite as INNER JOIN or use EXISTS for better performance"
                ))
        return issues

    def _check_function_on_column(self, parsed) -> List[SqlIssue]:
        # Detect function wrap trên column trong WHERE — phá index
        issues = []
        blocking_funcs = {
            "year", "month", "day", "date", "to_char",
            "extract", "lower", "upper", "trim", "substr", "substring"
        }
        for func in parsed.find_all(exp.Anonymous):
            if func.name.lower() in blocking_funcs:
                issues.append(SqlIssue(
                    type="function_on_column",
                    severity="high",
                    message=f"Function {func.name.upper()}() wrapping a column prevents index usage",
                    suggestion="Rewrite as range condition instead: col >= '...' AND col < '...'"
                ))
        return issues

    def _check_leading_wildcard_like(self, parsed) -> List[SqlIssue]:
        # Detect LIKE '%value' — không dùng được B-tree index
        issues = []
        for like_node in parsed.find_all(exp.Like):
            pattern = like_node.args.get("expression")
            if pattern and str(pattern).startswith("'%"):
                issues.append(SqlIssue(
                    type="leading_wildcard",
                    severity="high",
                    message="LIKE '%value' with leading wildcard cannot use B-tree index → full scan",
                    suggestion="Use full-text search (tsvector/GIN index) or reverse index trick"
                ))
        return issues

    def _check_or_conditions(self, parsed) -> List[SqlIssue]:
        # Detect OR trong WHERE — có thể ngăn index usage
        for _ in parsed.find_all(exp.Or):
            return [SqlIssue(
                type="or_condition",
                severity="low",
                message="OR conditions may prevent the planner from using indexes optimally",
                suggestion="Consider rewriting as UNION ALL if each branch can use a separate index"
            )]
        return []

    def _check_implicit_type_conversion(self, parsed) -> List[SqlIssue]:
        # Detect so sánh string với numeric column — implicit cast phá index
        issues = []
        for eq_node in parsed.find_all(exp.EQ):
            left = eq_node.left
            right = eq_node.right
            if isinstance(left, exp.Column) and isinstance(right, exp.Literal):
                if right.is_string and left.name.lower() in {"id", "user_id", "order_id"}:
                    issues.append(SqlIssue(
                        type="implicit_type_conversion",
                        severity="medium",
                        message=f"Comparing numeric column '{left.name}' with string literal causes implicit cast",
                        suggestion=f"Use numeric literal: WHERE {left.name} = 123 (not '123')"
                    ))
        return issues

    def _check_distinct_overuse(self, parsed) -> List[SqlIssue]:
        # Detect DISTINCT — thường là dấu hiệu JOIN bị nhân đôi row
        for _ in parsed.find_all(exp.Distinct):
            return [SqlIssue(
                type="distinct_overuse",
                severity="low",
                message="DISTINCT may indicate duplicate rows caused by incorrect JOIN",
                suggestion="Check JOIN conditions first; if intentional, GROUP BY is often faster"
            )]
        return []


sql_analyzer = SqlAntiPatternDetector()
~~~

---

### 2. Sửa file: `backend/app/core/prompts.py`

Thay thế hoàn toàn `SQL_OPTIMIZATION_SYSTEM_PROMPT` và `get_sql_optimization_prompt`.

~~~python
SQL_OPTIMIZATION_SYSTEM_PROMPT = """
You are a PostgreSQL Performance Expert. Output STRICT JSON only. No markdown. No explanation outside JSON.

### ANALYSIS CHECKLIST — check ALL of these before responding:
1. INDEX CHECK: Are WHERE/JOIN/ORDER BY columns covered by indexes in the schema?
2. SELECT * CHECK: Does the query use SELECT *? Rewrite to select only needed columns.
3. SUBQUERY CHECK: Does WHERE use IN (SELECT ...)? Rewrite to INNER JOIN or EXISTS.
4. FUNCTION ON COLUMN CHECK: Is a function wrapping a column in WHERE (e.g. YEAR(col), LOWER(col))? Rewrite to range/direct comparison.
5. LIKE LEADING WILDCARD: Does WHERE use LIKE '%value'? Flag it and suggest full-text search.
6. DISTINCT CHECK: Is DISTINCT used? Check if it hides a bad JOIN. Suggest GROUP BY if appropriate.
7. OR CONDITION CHECK: Are OR conditions used on indexed columns? Suggest UNION ALL rewrite if beneficial.

### OUTPUT FORMAT — respond ONLY with this JSON structure:
{
  "optimized_sql": "rewritten SQL, or original if no rewrite needed",
  "index_suggestion": "CREATE INDEX statement, or null if not needed",
  "rewrite_type": "none | select_columns | subquery_to_join | function_on_column | leading_wildcard | distinct_to_group | union_rewrite | multiple",
  "changes_made": ["list of specific changes made, e.g. 'Replaced SELECT * with explicit columns'"],
  "explanation": "max 3 sentences: what was changed, why, and expected impact"
}

### EXAMPLES:

Example 1 — Function on column + SELECT *:
Input SQL: SELECT * FROM orders WHERE YEAR(created_at) = 2024
Schema: Table orders(id PK, user_id, status, created_at) [Indexes: orders_pkey(id)]
Response:
{
  "optimized_sql": "SELECT id, user_id, status, created_at FROM orders WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'",
  "index_suggestion": "CREATE INDEX idx_orders_created_at ON orders (created_at);",
  "rewrite_type": "multiple",
  "changes_made": ["Removed YEAR() function to allow index usage", "Replaced SELECT * with explicit columns", "Added date range condition"],
  "explanation": "YEAR(created_at) wraps the column in a function, preventing index usage. Converted to explicit date range so the new index can be used. Replaced SELECT * to reduce I/O."
}

Example 2 — IN subquery:
Input SQL: SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE status = 'pending')
Schema: Table users(id PK, name, email), Table orders(id PK, user_id FK, status) [Indexes: orders_pkey(id)]
Response:
{
  "optimized_sql": "SELECT u.id, u.name, u.email FROM users u INNER JOIN orders o ON u.id = o.user_id WHERE o.status = 'pending'",
  "index_suggestion": "CREATE INDEX idx_orders_user_status ON orders (user_id, status);",
  "rewrite_type": "subquery_to_join",
  "changes_made": ["Converted IN subquery to INNER JOIN", "Replaced SELECT * with explicit columns"],
  "explanation": "IN (SELECT ...) can trigger repeated subquery evaluation. INNER JOIN lets the planner choose a more efficient hash or merge join strategy. Composite index on (user_id, status) covers both the JOIN and WHERE conditions."
}

Example 3 — No change needed:
Input SQL: SELECT id, name FROM users WHERE email = 'abc@example.com'
Schema: Table users(id PK, name, email) [Indexes: users_pkey(id), idx_users_email(email)]
Response:
{
  "optimized_sql": "SELECT id, name FROM users WHERE email = 'abc@example.com'",
  "index_suggestion": null,
  "rewrite_type": "none",
  "changes_made": [],
  "explanation": "Query is already optimized. Specific columns are selected and the email column has an index that will be used for the WHERE condition."
}
"""


def get_sql_optimization_prompt(
    sql_query: str,
    schema_text: str,
    detected_issues: str = ""
) -> str:
    issues_section = ""
    if detected_issues:
        issues_section = f"""
Pre-detected issues (from static analysis):
{detected_issues}

"""
    return f"""Input SQL:
{sql_query}

Relevant Schema:
{schema_text}

{issues_section}Task: Apply the ANALYSIS CHECKLIST. Return JSON only.
Response:"""
~~~

---

### 3. Sửa file: `backend/app/services/optimization_service.py`

#### 3a. Mở rộng `_extract_postgres_bottlenecks`

Thay thế method hiện tại bằng version mở rộng sau:

~~~python
@staticmethod
def _extract_postgres_bottlenecks(explain_plan: Dict[str, Any]) -> list[str]:
    bottlenecks = []
    plan = explain_plan.get("plan", [{}])[0].get("Plan", {})

    def traverse_plan(node: Dict[str, Any]) -> None:
        node_type       = node.get("Node Type", "")
        relation_name   = node.get("Relation Name", "unknown")
        total_cost      = node.get("Total Cost", 0)
        actual_rows     = node.get("Actual Rows", 0)
        plan_rows       = node.get("Plan Rows", 1)
        actual_loops    = node.get("Actual Loops", 1)
        filter_expr     = node.get("Filter", "")
        rows_removed    = node.get("Rows Removed by Filter", 0)
        sort_key        = node.get("Sort Key", [])
        sort_method     = node.get("Sort Method", "")
        hash_batches    = node.get("Hash Batches", 1)

        # 1. Sequential Scan
        if "Seq Scan" in node_type:
            msg = f"Sequential Scan on '{relation_name}' (no index used)"
            if filter_expr:
                msg += f" — filter: {filter_expr}"
            bottlenecks.append(msg)

        # 2. High filter rejection sau Seq Scan
        if "Seq Scan" in node_type and rows_removed > 500:
            bottlenecks.append(
                f"High row rejection on '{relation_name}': "
                f"{rows_removed} rows scanned but filtered out "
                f"→ add index on filter column"
            )

        # 3. Row estimate mismatch → stale statistics
        if plan_rows > 0:
            ratio = actual_rows / plan_rows
            if ratio > 10 or (ratio < 0.1 and actual_rows > 0):
                bottlenecks.append(
                    f"Poor row estimate on '{relation_name}': "
                    f"planner expected {plan_rows}, got {actual_rows} "
                    f"→ run ANALYZE to refresh statistics"
                )

        # 4. Nested Loop với nhiều loops
        if "Nested Loop" in node_type and actual_loops > 100:
            bottlenecks.append(
                f"Expensive Nested Loop ({actual_loops} loops, cost={total_cost:.0f}) "
                f"→ consider rewriting with explicit JOIN type or CTE"
            )

        # 5. Hash Join spill to disk
        if "Hash" in node_type and hash_batches > 1:
            bottlenecks.append(
                f"Hash Join spilled to disk ({hash_batches} batches) "
                f"→ increase work_mem or add better indexes"
            )

        # 6. External Sort (spill to disk)
        if "Sort" in node_type and "external" in sort_method.lower():
            bottlenecks.append(
                f"Sort spilled to disk on {sort_key} "
                f"→ increase work_mem or add index on ORDER BY columns"
            )

        # 7. In-memory Sort (có thể tối ưu bằng index)
        if "Sort" in node_type and sort_key and "external" not in sort_method.lower():
            bottlenecks.append(
                f"In-memory Sort on {sort_key} "
                f"→ consider adding index to avoid sort entirely"
            )

        for child in node.get("Plans", []):
            traverse_plan(child)

    traverse_plan(plan)
    return bottlenecks
~~~

#### 3b. Tích hợp `SqlAntiPatternDetector` vào `analyze_query`

Trong method `analyze_query` của class `OptimizationService`,
thêm đoạn sau ngay SAU step 3 (get EXPLAIN plan) và TRƯỚC step 4 (gọi LLM):

~~~python
# Step 3.5: Static SQL analysis (không cần DB)
from app.services.sql_analyzer import sql_analyzer

static_issues = sql_analyzer.detect(sql_query)
if static_issues:
    logger.info(
        f"[OPTIMIZE] Static analysis found {len(static_issues)} issue(s): "
        + ", ".join(i.type for i in static_issues)
    )
~~~

#### 3c. Pass `detected_issues` vào LLM call

Trong method `_get_optimization`, thêm tham số `static_issues`:

~~~python
async def _get_optimization(
    self,
    connection: DBConnection,
    sql_query: str,
    connection_id: UUID,
    static_issues: list = None,
) -> Dict[str, Any]:
    cached_result = self._cache.get(sql_query, connection_id)
    if cached_result:
        logger.info("[CACHE-HIT] Returning cached result")
        return cached_result

    db_schema_json = (
        json.dumps(connection.meta_schema)
        if connection.meta_schema else None
    )

    try:
        llm_result = await llm_service.optimize_sql(
            sql_query=sql_query,
            db_schema=db_schema_json,
            static_issues=static_issues or [],
        )
        self._cache.put(sql_query, connection_id, llm_result)
        return llm_result
    except Exception as e:
        logger.error(f"[OPTIMIZE] LLM optimization failed: {str(e)}")
        return {
            "optimized_sql": sql_query,
            "index_suggestion": None,
            "rewrite_type": "none",
            "changes_made": [],
            "explanation": f"Optimization failed. Error: {str(e)}",
        }
~~~

Và cập nhật call site trong `analyze_query`:

~~~python
llm_result = await self._get_optimization(
    connection, sql_query, connection_id, static_issues
)
~~~

#### 3d. Cập nhật `_build_response` để expose thêm fields

~~~python
def _build_response(
    self,
    llm_result: Dict[str, Any],
    original_cost: Optional[float],
    bottlenecks: list[str],
    sql_query: str,
    static_issues: list = None,
) -> Dict[str, Any]:
    optimized_sql       = self._ensure_string(llm_result.get("optimized_sql", sql_query))
    index_recommendation = llm_result.get("index_suggestion")
    explanation         = self._ensure_string(llm_result.get("explanation", "No explanation provided"))
    rewrite_type        = llm_result.get("rewrite_type", "none")
    changes_made        = llm_result.get("changes_made", [])

    # Merge bottlenecks từ EXPLAIN + static issues
    all_bottlenecks = list(bottlenecks)
    if static_issues:
        for issue in static_issues:
            all_bottlenecks.append(f"[{issue.severity.upper()}] {issue.message}")

    return {
        "original_cost":       original_cost,
        "bottlenecks":         all_bottlenecks,
        "optimized_sql":       optimized_sql.strip(),
        "index_recommendation": index_recommendation.strip() if index_recommendation else None,
        "explanation":         explanation.strip(),
        "rewrite_type":        rewrite_type,
        "changes_made":        changes_made,
    }
~~~

---

### 4. Sửa file: `backend/app/services/llm_service.py`

#### 4a. Cập nhật method `optimize_sql` để nhận `static_issues`

~~~python
async def optimize_sql(
    self,
    sql_query: str,
    db_schema: Optional[str] = None,
    static_issues: list = None,
) -> Dict[str, Any]:
    used_tables     = self._extract_table_names(sql_query)
    filtered_schema = self._filter_schema(db_schema, used_tables) if db_schema else ""

    schema_text = f"\nRelevant Schema:\n{filtered_schema}" if filtered_schema else ""

    # Format static issues thành text context cho LLM
    issues_text = ""
    if static_issues:
        issues_text = "\n".join(
            f"- [{i.severity.upper()}] {i.type}: {i.message}"
            for i in static_issues
        )

    # Dùng prompt mới có tham số detected_issues
    user_prompt = get_sql_optimization_prompt(
        sql_query=sql_query,
        schema_text=schema_text,
        detected_issues=issues_text,
    )

    payload_config = OllamaPayload(
        model=self.coder_model,
        prompt=user_prompt,
        system_prompt=SQL_OPTIMIZATION_SYSTEM_PROMPT,
        temperature=0.1,
        num_ctx=2048,
        num_predict=300,   # tăng từ 150 lên 300 vì response JSON lớn hơn
        json_mode=True,
    )

    url     = self._build_api_url()
    payload = payload_config.to_dict()
    payload["keep_alive"] = "120m"

    raw_response = await self._make_ollama_request(payload, url)
    logger.info(f"[OPTIMIZE] Raw LLM response: {raw_response}")

    return self._parse_optimization_response(raw_response, sql_query)
~~~

#### 4b. Cập nhật `_parse_optimization_response` để parse fields mới

~~~python
def _parse_optimization_response(
    self, raw_response: str, original_query: str
) -> Dict[str, Any]:
    try:
        clean_json = self._clean_json_response(raw_response)
        parsed = json.loads(clean_json)

        return {
            "optimized_sql":   parsed.get("optimized_sql", original_query),
            "index_suggestion": parsed.get("index_suggestion"),
            "rewrite_type":    parsed.get("rewrite_type", "none"),
            "changes_made":    parsed.get("changes_made", []),
            "explanation":     parsed.get("explanation", "Analysis completed"),
        }

    except json.JSONDecodeError as e:
        logger.error(f"[OPTIMIZE] Failed to parse JSON response: {e}")
        return {
            "optimized_sql":   original_query,
            "index_suggestion": None,
            "rewrite_type":    "none",
            "changes_made":    [],
            "explanation":     "Analysis failed due to response parsing error",
        }
~~~

---

### 5. Sửa file: `backend/app/schemas/sql.py`

Thêm 2 field mới vào `SQLOptimizeResponse`:

~~~python
class SQLOptimizeResponse(BaseModel):
    original_sql:          str
    optimized_sql:         str
    explanation:           str
    index_recommendation:  Optional[str]           = None
    rewrite_type:          Optional[str]           = None   # thêm mới
    changes_made:          Optional[List[str]]     = None   # thêm mới
    bottlenecks:           Optional[List[str]]     = None   # thêm mới (hiện đang bị drop)
    stats_comparison:      Optional[Dict[str, Any]] = None
    query_log_id:          Optional[UUID]          = None
~~~

---

### 6. Sửa file: `backend/app/api/v1/endpoints/sql.py`

Tìm endpoint optimize (thường là `POST /optimize`) và cập nhật phần build response
để map đầy đủ các field mới từ `optimization_service.analyze_query()`:

~~~python
return SQLOptimizeResponse(
    original_sql         = request.sql_query,
    optimized_sql        = result["optimized_sql"],
    explanation          = result["explanation"],
    index_recommendation = result.get("index_recommendation"),
    rewrite_type         = result.get("rewrite_type"),
    changes_made         = result.get("changes_made", []),
    bottlenecks          = result.get("bottlenecks", []),
    query_log_id         = result.get("query_log_id"),
)
~~~

---

### 7. Sửa file: `frontend/src/types/optimization.ts`

Thêm các field mới vào type definition:

~~~typescript
export interface OptimizeResponse {
  original_sql:          string;
  optimized_sql:         string;
  explanation:           string;
  index_recommendation?: string | null;
  rewrite_type?:         string | null;
  changes_made?:         string[];
  bottlenecks?:          string[];
  stats_comparison?:     Record<string, unknown> | null;
  query_log_id?:         string | null;
}

// Helper type cho badge display
export type RewriteType =
  | "none"
  | "select_columns"
  | "subquery_to_join"
  | "function_on_column"
  | "leading_wildcard"
  | "distinct_to_group"
  | "union_rewrite"
  | "multiple";

export const REWRITE_TYPE_LABELS: Record<RewriteType, string> = {
  none:               "No rewrite needed",
  select_columns:     "Column projection",
  subquery_to_join:   "Subquery → JOIN",
  function_on_column: "Function removed",
  leading_wildcard:   "LIKE pattern",
  distinct_to_group:  "DISTINCT → GROUP BY",
  union_rewrite:      "OR → UNION ALL",
  multiple:           "Multiple rewrites",
};

export const REWRITE_TYPE_COLORS: Record<RewriteType, string> = {
  none:               "bg-gray-100 text-gray-600",
  select_columns:     "bg-blue-100 text-blue-700",
  subquery_to_join:   "bg-orange-100 text-orange-700",
  function_on_column: "bg-red-100 text-red-700",
  leading_wildcard:   "bg-red-100 text-red-700",
  distinct_to_group:  "bg-yellow-100 text-yellow-700",
  union_rewrite:      "bg-purple-100 text-purple-700",
  multiple:           "bg-pink-100 text-pink-700",
};
~~~

---

### 8. Sửa file: `frontend/src/components/editor/OptimizationModal.tsx`

Cập nhật phần render để hiển thị:

1. **Rewrite type badge** — hiển thị ngay dưới tiêu đề modal
2. **Changes made list** — danh sách bullet các thay đổi cụ thể
3. **Bottlenecks section** — list các vấn đề phát hiện từ EXPLAIN + static analysis

Thêm 3 section mới vào JSX của modal, ví dụ đặt giữa phần "Explanation" và phần "SQL Diff":

~~~tsx
{/* Rewrite Type Badge */}
{result.rewrite_type && result.rewrite_type !== "none" && (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-sm font-medium text-gray-500">Optimization type:</span>
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
      REWRITE_TYPE_COLORS[result.rewrite_type as RewriteType] ?? "bg-gray-100 text-gray-600"
    }`}>
      {REWRITE_TYPE_LABELS[result.rewrite_type as RewriteType] ?? result.rewrite_type}
    </span>
  </div>
)}

{/* Changes Made */}
{result.changes_made && result.changes_made.length > 0 && (
  <div className="mb-4">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
      Changes applied:
    </p>
    <ul className="list-disc list-inside space-y-1">
      {result.changes_made.map((change, idx) => (
        <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
          {change}
        </li>
      ))}
    </ul>
  </div>
)}

{/* Bottlenecks */}
{result.bottlenecks && result.bottlenecks.length > 0 && (
  <div className="mb-4">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
      Issues detected:
    </p>
    <ul className="space-y-1">
      {result.bottlenecks.map((b, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <span className="mt-0.5">⚠</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
)}
~~~

---

## Checklist sau khi implement

- [ ] `sql_analyzer.py` tạo thành công, import được trong `optimization_service.py`
- [ ] `SQL_OPTIMIZATION_SYSTEM_PROMPT` đã được thay thế hoàn toàn
- [ ] `get_sql_optimization_prompt` nhận thêm tham số `detected_issues`
- [ ] `optimize_sql` trong `llm_service.py` nhận thêm `static_issues`
- [ ] `_parse_optimization_response` parse được `rewrite_type` và `changes_made`
- [ ] `_build_response` merge bottlenecks từ EXPLAIN và static issues
- [ ] `SQLOptimizeResponse` schema có đủ 3 field mới
- [ ] Endpoint trả về đầy đủ field mới
- [ ] Frontend type `OptimizeResponse` cập nhật
- [ ] `OptimizationModal.tsx` hiển thị badge + changes + bottlenecks
- [ ] Test với query có SELECT * → expect rewrite_type = "select_columns"
- [ ] Test với IN subquery → expect rewrite_type = "subquery_to_join"
- [ ] Test với YEAR(col) → expect rewrite_type = "function_on_column"