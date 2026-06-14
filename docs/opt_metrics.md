# Hướng dẫn: Thay thế chỉ số `cost` bằng `Actual Total Time` trong chức năng Optimize

## Bối cảnh & Vấn đề

Hiện tại chức năng optimize dùng **PostgreSQL Planner Cost** (`Total Cost`) làm chỉ số đo cải thiện:

```
stats_comparison: { old_cost: 1240.5, new_cost: 320.1, improvement_percent: 74.2 }
```

**Vấn đề:**
- `Total Cost` là đơn vị tưởng tượng của PostgreSQL planner (không phải milliseconds, không phải rows). Không ai ngoài DBA biết con số này nghĩa là gì.
- Không thể so sánh giữa các database hoặc giải thích với người không chuyên.
- Đối với MySQL, `query_cost` càng mơ hồ hơn.

**Mục tiêu:** Thay thế bằng **`Actual Total Time (ms)`** — thời gian thực tế PostgreSQL đo được khi chạy `EXPLAIN ANALYZE`. Con số này trực quan: "query cũ mất 320ms, query mới mất 80ms, nhanh hơn 4x".

---

## Tổng quan thay đổi

```
Layer               File                               Thay đổi
─────────────────────────────────────────────────────────────────────
DB Model            models/models.py                   Rename column (migration)
Service             optimization_service.py            Parse Actual Total Time thay vì Total Cost
API Endpoint        api/v1/endpoints/sql.py            Chạy EXPLAIN ANALYZE, build stats mới
API Schema          schemas/sql.py                     Cập nhật SQLOptimizeResponse
Frontend Types      types/optimization.ts              Cập nhật interface
Frontend UI         OptimizationModal.tsx              Hiển thị "ms" thay vì "cost units"
History             api/v1/endpoints/history.py        Map field mới
```

---

## Bước 1 — Database Migration

### 1.1 Tạo file migration Alembic

Tạo file `backend/alembic/versions/add_execution_time_metrics.py`:

```python
"""add execution time metrics to performance_analysis

Revision ID: add_exec_time_metrics
Revises: <revision_id_hiện_tại>
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_exec_time_metrics'
down_revision = '<revision_id_hiện_tại>'  # thay bằng revision cuối cùng
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Thêm cột mới lưu thời gian thực tế (ms)
    op.add_column(
        'performance_analysis',
        sa.Column('original_time_ms', sa.Float(), nullable=True)
    )
    op.add_column(
        'performance_analysis',
        sa.Column('optimized_time_ms', sa.Float(), nullable=True)
    )
    # Giữ nguyên total_cost để backward compatible với data cũ
    # (có thể drop sau khi đã xác nhận production ổn định)


def downgrade() -> None:
    op.drop_column('performance_analysis', 'original_time_ms')
    op.drop_column('performance_analysis', 'optimized_time_ms')
```

Chạy migration:
```bash
cd backend
alembic upgrade head
```

---

## Bước 2 — Cập nhật `models/models.py`

Thêm 2 cột mới vào class `PerformanceAnalysis`:

```python
class PerformanceAnalysis(Base):
    __tablename__ = "performance_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_log_id = Column(
        UUID(as_uuid=True),
        ForeignKey("query_logs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    execution_time_ms = Column(Float)   # giữ nguyên (legacy)
    total_cost = Column(Float)          # giữ nguyên (legacy)
    original_time_ms = Column(Float)    # MỚI: thời gian query gốc (ms)
    optimized_time_ms = Column(Float)   # MỚI: thời gian query sau optimize (ms)
    explain_plan = Column(JSONB, nullable=False)
    index_recommendation = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    query_log = relationship("QueryLog", back_populates="performance_analysis")
```

---

## Bước 3 — Cập nhật `optimization_service.py`

### 3.1 Cập nhật dataclass `ExplainResult`

```python
@dataclass
class ExplainResult:
    plan: Dict[str, Any]
    total_cost: float           # giữ nguyên để không break code cũ
    actual_total_time_ms: Optional[float] = None   # MỚI
    planning_time_ms: Optional[float] = None        # MỚI (bonus)
```

### 3.2 Cập nhật `_execute_postgres_explain`

`EXPLAIN (ANALYZE, FORMAT JSON)` trả về `Actual Total Time` ở root node. Cần parse thêm:

```python
@staticmethod
def _execute_postgres_explain(conn, sql_query: str) -> tuple[Dict, float, Optional[float], Optional[float]]:
    # Dùng EXPLAIN ANALYZE để có Actual Total Time
    explain_query = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}"
    result_proxy = conn.execute(text(explain_query))
    explain_output = result_proxy.fetchone()[0]

    plan_data = (
        json.loads(explain_output)
        if isinstance(explain_output, str)
        else explain_output
    )

    root_plan = plan_data[0]["Plan"] if plan_data else {}
    total_cost = root_plan.get("Total Cost", 0.0)

    # Actual Total Time: thời gian thực (ms) từ root node
    # PostgreSQL đặt ở "Actual Total Time" tính trên 1 loop
    actual_loops = root_plan.get("Actual Loops", 1) or 1
    actual_total_time_ms = root_plan.get("Actual Total Time", None)
    if actual_total_time_ms is not None:
        # Nhân với loops để ra tổng thời gian
        actual_total_time_ms = actual_total_time_ms * actual_loops

    # Planning Time là field riêng ở top-level output (ngoài Plan)
    planning_time_ms = plan_data[0].get("Planning Time", None) if plan_data else None

    return plan_data, total_cost, actual_total_time_ms, planning_time_ms
```

> **Lưu ý về `Actual Total Time`:** PostgreSQL báo cáo thời gian tính trên mỗi loop của node. Với nested loop, cần nhân với `Actual Loops`. Root node thường có Loops=1, nên ổn với hầu hết trường hợp.

### 3.3 Cập nhật `get_explain_plan` để trả về field mới

```python
@staticmethod
async def get_explain_plan(
    connection: DBConnection, sql_query: str
) -> Optional[ExplainResult]:
    # ... (các phần khác giữ nguyên) ...

    with engine.connect() as conn:
        if connection.db_type == DBType.POSTGRES:
            plan_data, total_cost, actual_time_ms, planning_time_ms = (
                ExplainPlanAnalyzer._execute_postgres_explain(conn, sql_query)
            )
        elif connection.db_type == DBType.MYSQL:
            # MySQL EXPLAIN FORMAT=JSON không có Actual Time
            # Giữ nguyên logic cũ, actual_time_ms = None
            plan_data, total_cost = ExplainPlanAnalyzer._execute_mysql_explain(conn, sql_query)
            actual_time_ms = None
            planning_time_ms = None

    engine.dispose()
    return ExplainResult(
        plan=plan_data,
        total_cost=float(total_cost),
        actual_total_time_ms=actual_time_ms,
        planning_time_ms=planning_time_ms,
    )
```

### 3.4 Cập nhật `analyze_query` để forward field mới

Trong method `analyze_query`, phần Step 3:

```python
if explain_result:
    explain_plan = explain_result.plan
    original_cost = explain_result.total_cost
    original_time_ms = explain_result.actual_total_time_ms  # MỚI
    planning_time_ms = explain_result.planning_time_ms      # MỚI
    bottlenecks = ExplainPlanAnalyzer.extract_bottlenecks(
        {"plan": explain_plan}, connection.db_type
    )
else:
    explain_plan = None
    original_cost = None
    original_time_ms = None   # MỚI
    planning_time_ms = None   # MỚI
    bottlenecks = []
```

Cập nhật `_build_response` để nhận thêm `original_time_ms`:

```python
def _build_response(
    self,
    llm_result: Dict[str, Any],
    original_cost: Optional[float],
    original_time_ms: Optional[float],  # MỚI
    bottlenecks: list[str],
    sql_query: str,
    static_issues: Optional[list[SqlIssue]] = None,
) -> Dict[str, Any]:
    # ... (logic cũ) ...
    return {
        "original_cost": original_cost,
        "original_time_ms": original_time_ms,  # MỚI
        "bottlenecks": all_bottlenecks,
        "optimized_sql": optimized_sql.strip(),
        "index_recommendation": ...,
        "explanation": explanation.strip(),
        "rewrite_type": rewrite_type,
        "changes_made": changes_made,
    }
```

Cập nhật call `_build_response` trong `analyze_query`:

```python
response = self._build_response(
    llm_result,
    original_cost,
    original_time_ms,   # MỚI
    bottlenecks,
    sql_query,
    static_issues,
)
```

### 3.5 Cập nhật `QueryLogManager.save_performance_analysis`

```python
@staticmethod
async def save_performance_analysis(
    db: AsyncSession,
    query_log: QueryLog,
    explain_plan: Optional[Dict[str, Any]],
    original_cost: Optional[float],
    original_time_ms: Optional[float],   # MỚI
    optimized_time_ms: Optional[float],  # MỚI
    index_recommendation: Optional[str],
    optimized_sql: str,
) -> Optional[str]:
    try:
        performance_analysis = PerformanceAnalysis(
            query_log_id=query_log.id,
            execution_time_ms=None,
            total_cost=original_cost,
            original_time_ms=original_time_ms,     # MỚI
            optimized_time_ms=optimized_time_ms,   # MỚI
            explain_plan=explain_plan,
            index_recommendation=index_recommendation,
        )
        # ... (phần còn lại giữ nguyên)
```

---

## Bước 4 — Cập nhật `api/v1/endpoints/sql.py`

### 4.1 Phần chạy EXPLAIN cho optimized query

Hiện tại đang dùng `EXPLAIN (FORMAT JSON)` (không có ANALYZE). Cần đổi sang `EXPLAIN (ANALYZE, FORMAT JSON)` để lấy `Actual Total Time`:

```python
optimized_cost = None
optimized_time_ms = None  # MỚI

if request.include_explain and connection.db_type != DBType.SIMULATION:
    logger.info("[OPTIMIZE] Running EXPLAIN ANALYZE on optimized query")
    try:
        # ... (build engine giữ nguyên) ...

        with engine.connect() as conn:
            if connection.db_type == DBType.POSTGRES:
                # Đổi sang ANALYZE để có Actual Total Time
                explain_query = f"EXPLAIN (ANALYZE, FORMAT JSON) {optimized_sql}"
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]
                plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                
                optimized_cost = plan_data[0]["Plan"]["Total Cost"]
                
                # Parse Actual Total Time
                root_plan = plan_data[0]["Plan"]
                actual_loops = root_plan.get("Actual Loops", 1) or 1
                raw_time = root_plan.get("Actual Total Time", None)
                if raw_time is not None:
                    optimized_time_ms = raw_time * actual_loops

            elif connection.db_type == DBType.MYSQL:
                # MySQL: giữ nguyên, không có Actual Time
                explain_query = f"EXPLAIN FORMAT=JSON {optimized_sql}"
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]
                plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                optimized_cost = (
                    plan_data.get("query_block", {})
                    .get("cost_info", {})
                    .get("query_cost", 0.0)
                )
                # optimized_time_ms = None (MySQL không hỗ trợ)

        engine.dispose()

    except Exception as e:
        logger.warning(f"[OPTIMIZE] Could not get metrics for optimized query: {str(e)}")
```

### 4.2 Cập nhật logic build `stats_comparison`

Thay thế hoàn toàn block `stats_comparison` hiện tại:

```python
stats_comparison = None
original_time_ms = analysis.get("original_time_ms")

# Ưu tiên time-based metrics (PostgreSQL real execution time)
if original_time_ms is not None and optimized_time_ms is not None:
    try:
        orig_ms = float(original_time_ms)
        opt_ms = float(optimized_time_ms)

        if orig_ms > 0:
            speedup_factor = orig_ms / opt_ms if opt_ms > 0 else float("inf")
            improvement_percent = round(((orig_ms - opt_ms) / orig_ms) * 100, 2)
        else:
            speedup_factor = 1.0
            improvement_percent = 0.0

        stats_comparison = {
            "metric_type": "execution_time",          # MỚI: client biết loại metric
            "original_time_ms": round(orig_ms, 3),
            "optimized_time_ms": round(opt_ms, 3),
            "improvement_percent": improvement_percent,
            "speedup_factor": round(speedup_factor, 2),
            # Giữ backward compat nếu client cũ dùng old_cost/new_cost
            "old_cost": original_cost,
            "new_cost": optimized_cost,
        }

        logger.info(
            f"[OPTIMIZE] Time comparison: {orig_ms:.3f}ms → {opt_ms:.3f}ms "
            f"({improvement_percent:.1f}% improvement, {speedup_factor:.1f}x faster)"
        )

    except (ValueError, TypeError) as e:
        logger.warning(f"[OPTIMIZE] Could not calculate time comparison: {str(e)}")

# Fallback: dùng cost nếu không có time (MySQL, hoặc EXPLAIN ANALYZE fail)
elif original_cost is not None and optimized_cost is not None:
    try:
        orig_c = float(original_cost)
        opt_c = float(optimized_cost)
        improvement_percent = round(((orig_c - opt_c) / orig_c) * 100, 2) if orig_c > 0 else 0.0

        stats_comparison = {
            "metric_type": "planner_cost",            # client biết đây là cost, không phải time
            "old_cost": orig_c,
            "new_cost": opt_c,
            "improvement_percent": improvement_percent,
            "speedup_factor": None,
            "original_time_ms": None,
            "optimized_time_ms": None,
        }

        logger.info(
            f"[OPTIMIZE] Cost comparison (fallback): {orig_c} → {opt_c} "
            f"({improvement_percent}% improvement)"
        )
    except (ValueError, TypeError) as e:
        logger.warning(f"[OPTIMIZE] Could not calculate cost comparison: {str(e)}")
```

### 4.3 Cập nhật call `save_performance_analysis`

```python
if query_log:
    response["query_log_id"] = await (
        QueryLogManager.save_performance_analysis(
            db,
            query_log,
            explain_plan,
            original_cost,
            original_time_ms,   # MỚI
            optimized_time_ms,  # MỚI — lấy từ phần EXPLAIN optimized ở trên
            response["index_recommendation"],
            response["optimized_sql"],
        )
    )
```

> **Lưu ý:** `optimized_time_ms` được tính ở bước EXPLAIN trong endpoint, không phải trong `optimization_service`. Cần đưa giá trị này vào sau khi bước EXPLAIN chạy xong trước khi gọi `save_performance_analysis`.

---

## Bước 5 — Cập nhật `schemas/sql.py`

```python
class StatsComparison(BaseModel):
    metric_type: str                        # "execution_time" | "planner_cost"
    original_time_ms: Optional[float] = None
    optimized_time_ms: Optional[float] = None
    improvement_percent: float
    speedup_factor: Optional[float] = None  # ví dụ: 4.0 = nhanh hơn 4x
    # Backward compat
    old_cost: Optional[float] = None
    new_cost: Optional[float] = None


class SQLOptimizeResponse(BaseModel):
    original_sql: str
    optimized_sql: str
    explanation: str
    index_recommendation: Optional[str] = None
    rewrite_type: Optional[str] = None
    changes_made: Optional[list[str]] = []
    bottlenecks: Optional[list[str]] = []
    stats_comparison: Optional[StatsComparison] = None
    query_log_id: Optional[str] = None
```

---

## Bước 6 — Cập nhật Frontend

### 6.1 `types/optimization.ts`

```typescript
export interface StatsComparison {
  metric_type: 'execution_time' | 'planner_cost';
  original_time_ms: number | null;
  optimized_time_ms: number | null;
  improvement_percent: number;
  speedup_factor: number | null;
  // backward compat
  old_cost?: number | null;
  new_cost?: number | null;
}

export interface OptimizationAnalysis {
  original_cost: number | null;
  bottlenecks: string[];
  optimized_sql: string;
  index_recommendation?: string;
  explanation: string;
  rewrite_type?: string | null;
  changes_made?: string[];
  stats_comparison?: StatsComparison;  // cập nhật type
}

export interface OptimizationResponse {
  original_sql: string;
  optimized_sql: string;
  explanation: string;
  index_recommendation?: string | null;
  rewrite_type?: string | null;
  changes_made?: string[];
  bottlenecks?: string[];
  stats_comparison?: StatsComparison | null;  // cập nhật type
  query_log_id?: string | null;
}
```

### 6.2 `OptimizationModal.tsx` — Hiển thị chỉ số

Thay thế phần render `improvement` (hiện tại khoảng dòng 71-119):

```tsx
// Helper: format ms với đơn vị tự động
function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 1) return `${ms.toFixed(1)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

// Trong component:
const stats = analysis.stats_comparison;

const renderStatsComparison = () => {
  if (!stats) return null;

  if (stats.metric_type === 'execution_time' && stats.original_time_ms != null && stats.optimized_time_ms != null) {
    const isImproved = stats.improvement_percent > 0;
    const badgeColor = isImproved
      ? 'bg-green-100 text-green-700'
      : stats.improvement_percent < 0
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-600';

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${badgeColor}`}>
        ⏱ {formatMs(stats.original_time_ms)} → {formatMs(stats.optimized_time_ms)}
        {stats.speedup_factor != null && stats.speedup_factor !== 1 && (
          <span>
            ({isImproved ? `${stats.speedup_factor}x faster` : `${(1/stats.speedup_factor).toFixed(1)}x slower`})
          </span>
        )}
      </span>
    );
  }

  // Fallback: hiển thị cost với label rõ ràng hơn
  if (stats.metric_type === 'planner_cost' && stats.old_cost != null && stats.new_cost != null) {
    const isImproved = stats.improvement_percent > 0;
    const badgeColor = isImproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${badgeColor}`}>
        📊 Planner cost: {stats.old_cost.toFixed(0)} → {stats.new_cost.toFixed(0)}
        {` (${isImproved ? '-' : '+'}${Math.abs(stats.improvement_percent)}%)`}
        <span className="text-xs text-gray-500 ml-1">(est.)</span>
      </span>
    );
  }

  return null;
};

// Dùng trong JSX:
{renderStatsComparison()}
```

### 6.3 `HistoryTable.tsx` — Cập nhật hiển thị lịch sử

```typescript
// Trong history endpoint types (history.ts):
export interface HistoryPerformance {
  original_time_ms?: number | null;
  optimized_time_ms?: number | null;
  total_cost?: number | null;  // backward compat
}
```

---

## Bước 7 — Cập nhật `api/v1/endpoints/history.py`

Trong schema trả về history, bổ sung field mới:

```python
class HistoryOptimizationStats(BaseModel):
    total_cost: Optional[float] = None          # backward compat
    original_time_ms: Optional[float] = None    # MỚI
    optimized_time_ms: Optional[float] = None   # MỚI

# Trong query/mapping:
original_time_ms=(
    log.performance_analysis.original_time_ms
    if log.performance_analysis else None
),
optimized_time_ms=(
    log.performance_analysis.optimized_time_ms
    if log.performance_analysis else None
),
```

---

## Lưu ý quan trọng

### `EXPLAIN ANALYZE` chạy query thật

`EXPLAIN ANALYZE` **thực sự chạy câu query** để đo thời gian — không chỉ estimate. Điều này có nghĩa:

- **Không dùng cho DML** (`INSERT`, `UPDATE`, `DELETE`) trực tiếp vì sẽ thay đổi dữ liệu. Wrap trong transaction rồi rollback:
  ```python
  # Với DML, wrap trong savepoint
  conn.execute(text("SAVEPOINT explain_savepoint"))
  result = conn.execute(text(f"EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}"))
  conn.execute(text("ROLLBACK TO SAVEPOINT explain_savepoint"))
  ```
- Với `SELECT`, an toàn hoàn toàn.
- Cần check `sql_query.strip().upper().startswith("SELECT")` trước khi dùng ANALYZE để tránh side effect.

### Thời gian không ổn định với sandbox nhỏ

Sandbox PostgreSQL seed rất ít data (~10-50 rows/table), nên `Actual Total Time` sẽ rất nhỏ (< 1ms). Điều này bình thường — quan trọng hơn là tỉ lệ cải thiện và loại operation (Seq Scan vs Index Scan).

### Fallback MySQL

MySQL `EXPLAIN FORMAT=JSON` không có `Actual Total Time`. Với MySQL, giữ nguyên `planner_cost` fallback. Có thể cải thiện sau bằng cách dùng `EXPLAIN ANALYZE` (MySQL 8.0.18+) nhưng format khác PostgreSQL.

### Ordering ưu tiên metric

```
PostgreSQL + include_explain=true  →  execution_time (ms) — chính xác nhất
MySQL + include_explain=true       →  planner_cost (fallback)
SIMULATION connection              →  không có stats_comparison (None)
include_explain=false              →  không có stats_comparison (None)
```

---

## Checklist triển khai

- [ ] Tạo và chạy Alembic migration (thêm `original_time_ms`, `optimized_time_ms`)
- [ ] Cập nhật `models/models.py` (thêm 2 column mới vào `PerformanceAnalysis`)
- [ ] Cập nhật `ExplainResult` dataclass (thêm `actual_total_time_ms`, `planning_time_ms`)
- [ ] Cập nhật `_execute_postgres_explain` (parse `Actual Total Time`)
- [ ] Cập nhật `get_explain_plan` (return field mới)
- [ ] Cập nhật `analyze_query` và `_build_response` (forward `original_time_ms`)
- [ ] Cập nhật `save_performance_analysis` signature (thêm 2 param mới)
- [ ] Cập nhật `sql.py` endpoint: đổi optimized EXPLAIN sang ANALYZE, build `stats_comparison` mới
- [ ] Cập nhật `schemas/sql.py` (thêm `StatsComparison` model, cập nhật `SQLOptimizeResponse`)
- [ ] Cập nhật `types/optimization.ts` frontend
- [ ] Cập nhật `OptimizationModal.tsx` render logic
- [ ] Cập nhật `history.py` endpoint + history types
- [ ] Test với PostgreSQL real connection: verify `Actual Total Time` được parse đúng
- [ ] Test với SIMULATION: verify `stats_comparison = null` (không crash)
- [ ] Test với MySQL: verify fallback về `planner_cost`