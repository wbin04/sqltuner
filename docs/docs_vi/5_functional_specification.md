# VAI TRÒ
Bạn là Senior Product Manager chuyên về Developer Tools. Nhiệm vụ của bạn là viết Tài liệu Đặc tả Chức năng Chi tiết (PRD) cho dự án "Smart SQL Assistant & Performance Tuner".

# NGỮ CẢNH DỰ ÁN
- **Sản phẩm:** Một công cụ dựa trên web cho phép các nhà phát triển trò chuyện với cơ sở dữ liệu của họ bằng AI, tạo SQL, và phân tích các điểm nghẽn hiệu suất.
- **Người dùng:** Backend Developers, DBAs, Data Analysts.
- **Tech Stack:** React (Frontend), FastAPI (Backend), PostgreSQL (Internal DB), Ollama (AI).

# YÊU CẦU ĐẦU RA

Vui lòng định nghĩa các yêu cầu chi tiết cho 4 module sau. Đối với mỗi tính năng, liệt kê **Đầu vào**, **Quy trình**, và **Đầu ra Mong đợi**.

## MODULE 1: Quản lý Kết nối (Nền tảng)
- **Tính năng 1.1:** Thêm Kết nối Mới (Hỗ trợ PostgreSQL/MySQL).
  - *Ràng buộc:* Mật khẩu phải được mã hóa trước khi lưu trữ.
- **Tính năng 1.2:** Schema Introspection (Đồng bộ).
  - *Logic:* Tự động lấy tên Bảng, Cột, và Khóa Ngoại khi kết nối.
  - *Ràng buộc:* Chỉ truy cập metadata chỉ đọc (Không lấy dữ liệu hàng).

## MODULE 2: AI SQL Assistant (Chatbot)
- **Tính năng 2.1:** Chat Nhận thức Ngữ cảnh.
  - *Logic:* Chèn Schema DB đã chọn vào System Prompt.
- **Tính năng 2.2:** Tạo Text-to-SQL.
  - *Logic:* Chuyển đổi ngôn ngữ tự nhiên thành SQL.
- **Tính năng 2.3:** Thực thi SQL & An toàn.
  - *Logic:* Thực thi truy vấn Đọc (SELECT). Chặn hoặc cảnh báo trên truy vấn Ghi (DROP, DELETE, UPDATE).

## MODULE 3: Performance Tuner (Giá trị Cốt lõi)
- **Tính năng 3.1:** Hiển thị Kế hoạch Truy vấn.
  - *Logic:* Chạy `EXPLAIN (ANALYZE, FORMAT JSON)`. Phân tích JSON để trích xuất 'Total Cost', 'Execution Time'.
- **Tính năng 3.2:** Tư vấn Tối ưu hóa AI.
  - *Logic:* AI phân tích Kế hoạch Truy vấn + Schema để đề xuất Indexes hoặc Viết lại Truy vấn.

## MODULE 4: Vòng lặp Phản hồi (Để Tinh chỉnh)
- **Tính năng 4.1:** Đánh giá & Sửa chữa.
  - *Logic:* Người dùng có thể vote (Like/Dislike) và chỉnh sửa SQL được tạo nếu sai.
  - *Mục tiêu:* Lưu trữ cặp 'Bad SQL' vs 'Corrected SQL' để tinh chỉnh mô hình trong tương lai.