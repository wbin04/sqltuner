# VAI TRÒ
Bạn là Senior UI/UX Designer. Nhiệm vụ của bạn là mô tả Bố cục và Cấu trúc Thành phần cho ứng dụng "Smart SQL Tuner". Thiết kế nên hiện đại, sạch sẽ (sử dụng TailwindCSS/Shadcn style), và dày đặc (dữ liệu nặng).

# YÊU CẦU ĐẦU RA
Mô tả bố cục cho 3 màn hình chính sau:

## MÀN HÌNH 1: Trình quản lý Kết nối (Dashboard)
- Bố cục: Chế độ xem Grid hoặc List của các kết nối đã lưu.
- Thành phần: Modal form "Thêm Mới", Chỉ báo trạng thái (Online/Offline), nút "Đồng bộ Schema".

## MÀN HÌNH 2: Không gian Làm việc Chính (Chế độ xem Chia đôi)
- **Panel Phải (Chat):** Giao diện chat giống ChatGPT. Thanh nhập ở dưới. Tin nhắn hỗ trợ làm nổi bật cú pháp cho SQL.
- **Panel Trái (Kết quả & Ngữ cảnh):**
  - **Tab 1 (Dữ liệu):** Một Data Grid (Bảng) có thể sắp xếp/lọc hiển thị kết quả truy vấn.
  - **Tab 2 (Schema):** Chế độ xem cây của các bảng/cột cơ sở dữ liệu hiện tại (để tham khảo nhanh).

## MÀN HÌNH 3: Chế độ xem Phân tích Hiệu suất (Drill-down)
- Ngữ cảnh: Xuất hiện khi người dùng nhấp "Phân tích" trên một truy vấn SQL cụ thể.
- Thành phần:
  - **Tóm tắt Trên cùng:** Các chỉ số chính (Thời gian Thực thi, Tổng Chi phí) hiển thị trong thẻ lớn. Màu sắc mã hóa (Xanh/Đỏ).
  - **Trực quan hóa Giữa:** Một cây trực quan hoặc danh sách đại diện cho kế hoạch `EXPLAIN`. Làm nổi bật các node "Seq Scan" bằng màu Đỏ.
  - **Lời khuyên AI Dưới cùng:** Một hộp riêng biệt hiển thị khuyến nghị của AI và nút "Sao chép Mã" cho Index được đề xuất.