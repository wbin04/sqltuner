# VAI TRÒ
Bạn là Lead UI/UX Designer chuyên về **Data-Intensive Developer Tools** (tương tự Supabase, Datadog, hoặc Vercel dashboards).
Nhiệm vụ của bạn là thiết kế **Wireframe Specifications** cho "SQLTuner" - một nền tảng tối ưu hóa SQL được hỗ trợ bởi AI.

# NGÔN NGỮ TRỰC QUAN & THEME
- **Style:** "Midnight Blue" Dark Mode (Hiện đại, Sạch, Độ tương phản cao).
- **Colors:** Background (`#020617`), Surface (`#0F172A`), Primary (`#3B82F6`), Success (`#22C55E`), Error (`#EF4444`).
- **Typography:** Inter / JetBrains Mono (cho code).

# NGỮ CẢNH DATA MODEL (PostgreSQL)
UI phải phản ánh chặt chẽ cấu trúc dữ liệu dưới đây. Mọi trường input và giá trị hiển thị phải ánh xạ đến cột cơ sở dữ liệu.

```sql
-- Users (Auth)
CREATE TABLE users (id, email, password, role...);

-- Connections (Dashboard items)
CREATE TABLE db_connections (
    id, name, host, port, username, db_password, db_name, db_type
);

-- Conversations (Chat Sessions)
CREATE TABLE conversations (id, connection_id, title);

-- Query Logs (Chat History)
CREATE TABLE query_logs (id, conversation_id, role, content, sql_generated);

-- Feedbacks (RLHF Data)
CREATE TABLE feedbacks (query_log_id, rating, corrected_sql, comment);

-- Performance (Analysis Report)
CREATE TABLE performance_analysis (
    query_log_id, execution_time_ms, total_cost, explain_plan (JSONB), index_recommendation
);
```

# ĐẦU RA: WIREFRAME SPECIFICATIONS

Vui lòng mô tả layout, components, và data mapping cho **4 Màn hình Cốt lõi** sau.

## MÀN HÌNH 1: THE WORKSPACE HUB (Dashboard)
**Mục tiêu:** Quản lý `db_connections`.
**Layout:**
- **Header:** Logo, User Avatar (`users.email`), Settings.
- **Hero Section:** Hai thẻ lớn: "Connect Existing DB" vs "Create Sandbox Simulation".
- **Grid List:** Hiển thị items từ `db_connections`.
**Chi tiết Component:**
1.  **Connection Card:**
    -   Title: `db_connections.name`
    -   Badge: `db_connections.db_type` (Postgres/MySQL).
    -   Subtext: `db_connections.host` : `db_connections.port` / `db_connections.db_name`.
    -   Status Indicator: Online/Offline (Kiểm tra thời gian thực).
2.  **Add Connection Modal:**
    -   Form inputs ánh xạ trực tiếp đến: `host`, `port`, `username`, `password` (masked), `db_name`.
    -   Nút "Test Connection".

## MÀN HÌNH 2: THE INTELLIGENT EDITOR (Main Interface)
**Mục tiêu:** Xử lý `conversations` và `query_logs`.
**Layout:** 3-Pane Layout (Sidebar, Chat, Context).
**Pane 1: Sidebar (Trái)**
-   Danh sách `conversations` (lấy theo `connection_id`).
-   Nút: "New Chat".
-   Nhóm theo Ngày (Today, Yesterday, Last Week).
**Pane 2: Chat Stream (Giữa)**
-   **User Message Bubble:** Hiển thị `query_logs.content` (User role).
-   **AI Response Bubble:** Hiển thị `query_logs.content` (Assistant role).
-   **SQL Block:** Nếu `query_logs.sql_generated` tồn tại, hiển thị trong Code Editor (Monaco) với syntax highlighting.
-   **Action Bar (dưới SQL):**
    -   "Run Query" (Execute).
    -   "Explain" (Trigger Analysis).
    -   "Optimize" (Trigger AI Refactor).
**Pane 3: Data & Schema (Phải - Collapsible)**
-   **Tab A: Results:** Data Grid hiển thị kết quả truy vấn.
-   **Tab B: Schema:** Tree view của Tables/Columns (lấy qua Inspector Service).

## MÀN HÌNH 3: PERFORMANCE DRILL-DOWN (Modal/Overlay)
**Mục tiêu:** Visualize `performance_analysis`.
**Trigger:** Người dùng nhấp "Explain" trên SQL block.
**Layout:**
-   **Summary Header:**
    -   Execution Time: `execution_time_ms` (Màu mã hóa: Green < 100ms, Red > 1s).
    -   Cost: `total_cost`.
-   **Visual Explain Plan:**
    -   Render `explain_plan` (JSONB) dưới dạng Tree Graph hoặc Flame Graph.
    -   Làm nổi bật "Seq Scan" nodes bằng màu Red.
    -   Làm nổi bật "Index Scan" nodes bằng màu Green.
-   **AI Recommendation Box:**
    -   Hiển thị `index_recommendation`.
    -   Nút "Apply Index" (Copy `CREATE INDEX` SQL).

## MÀN HÌNH 4: FEEDBACK LOOP (Inline Component)
**Mục tiêu:** Thu thập dữ liệu cho bảng `feedbacks`.
**Vị trí:** Đính kèm với mọi AI Response Bubble trong Screen 2.
**Components:**
-   **Thumbs Up/Down:** Đặt `feedbacks.rating` (1 hoặc 0).
-   **"Edit SQL" Mode:**
    -   Nếu AI tạo SQL sai, người dùng nhấp "Edit".
    -   Mở inline editor.
    -   On Save: Cập nhật `feedbacks.corrected_sql` và `feedbacks.comment`.
    -   Toast Message: "Thanks! This helps train our model."

# HƯỚNG DẪN CHO ĐẦU RA
- Cung cấp phản hồi ở định dạng **Markdown**.
- Cho mỗi màn hình, mô tả **Hierarchy**, **UI Elements**, và **User Interactions**.
- Rõ ràng nêu **Database Columns** nào đang được Đọc từ hoặc Ghi vào trong mỗi phần.