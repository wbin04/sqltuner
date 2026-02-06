# Roadmap Phát Triển Tính Năng SQLTuner

## Giai đoạn 1: Hoàn thiện trải nghiệm "Landing" & "Quản lý" (Ưu tiên SỐ 1)
Hiện tại bạn đã có Login và Editor, nhưng đang thiếu "khớp nối" giữa chúng. User đăng nhập xong cần một nơi để quản lý tài sản của họ.

### 1. Dashboard & Project Management (Trang chủ người dùng)
* **Vấn đề:** Sau khi login, user cần thấy các schema/kết nối cũ chứ không phải màn hình trống.
* **Triển khai:**
    * **Project Card:** Hiển thị tên dự án, loại DB (`Postgres`/`MySQL`/`Sim`), ngày sửa cuối.
    * **Trạng thái:** Hiển thị nhanh trạng thái (Ví dụ: "Simulation - 15 tables", "Live - Connected").
    * **Thao tác:** Duplicate Project (nhân bản schema để thử nghiệm nhánh khác), Export, Delete.
* **Tech:** API CRUD `Projects`, Frontend Grid Layout.

### 2. Snapshot & Versioning (Lịch sử phiên bản)
* **Vấn đề:** Khi thiết kế hoặc tối ưu, user lỡ tay xóa bảng hoặc sửa sai index thì không undo được.
* **Triển khai:**
    * Mỗi lần bấm "Save", tạo một bản ghi snapshot (JSON diff hoặc lưu full JSON).
    * Cho phép user xem lại lịch sử: "Version 1 (10:00 AM) - Added Users table".
    * Nút **Restore** để quay lại phiên bản cũ.

---

## Giai đoạn 2: Nâng cấp cốt lõi "Tuning" (Linh hồn của sản phẩm)
Đây là nhóm tính năng giúp SQLTuner vượt trội so với các công cụ quản lý DB thông thường (như DBeaver, pgAdmin).

### 3. Visual Explain Plan (Trực quan hóa thực thi)
* **Hiện tại:** Bạn đã lấy được Plan dạng text/structure.
* **Nâng cấp:** Sử dụng thư viện (như `ReactFlow` bạn đang dùng cho ERD) để vẽ **Cây thực thi (Execution Tree)**.

* **Logic:**
    * Node màu đỏ: `Seq Scan` / `Full Table Scan` (Cảnh báo chậm).
    * Node màu xanh: `Index Scan` / `Seek` (Tốt).
    * Hiển thị cost/rows ngay trên node.
* **Giá trị:** Giúp user nhìn vào là biết ngay đoạn nào gây chậm (bottleneck).

### 4. Performance Benchmark (A/B Testing)
* **Ý tưởng:** Khi AI gợi ý "Tạo Index X", user cần biết "Nó nhanh hơn bao nhiêu?".
* **Triển khai:**
    * Chế độ **"Compare Mode"**: Chạy Query gốc (A) và Query tối ưu (B) song song.
    * Hiển thị biểu đồ so sánh: Thời gian thực thi (ms), Số dòng quét (rows scanned).
* **Lưu ý:** Với Simulation (`SQLite in-memory`), thời gian có thể quá nhanh (0ms). Cần so sánh dựa trên **"Query Cost"** hoặc **"Opcode Count"** thay vì thời gian thực.

### 5. Import DDL (Reverse Engineering)
* **Vấn đề:** User mới không muốn vẽ lại từ đầu. Họ đã có file SQL `CREATE TABLE`.
* **Triển khai:**
    * Nút **"Import SQL"**.
    * User paste đoạn script tạo bảng vào.
    * Hệ thống parse SQL -> Chuyển thành JSON Schema -> Vẽ lên ERD Editor ngay lập tức.

---

## Giai đoạn 3: Mở rộng hệ sinh thái (Advanced Features)

### 6. Export & Migration System
* **Mục tiêu:** Mang thiết kế từ SQLTuner ra dự án thật.
* **Triển khai:**
    * **Export SQL:** Xuất file `.sql` tương thích (`Postgres`/`MySQL`/`SQLite`).
    * **Export ORM:** Xuất schema cho Prisma, TypeORM, hoặc SQLAlchemy models (Python).
    * **Diff Generation:** So sánh Schema hiện tại với Schema cũ -> Sinh ra lệnh `ALTER TABLE...` (Migration script).

### 7. Collaboration (Chia sẻ)
* **Mục tiêu:** Làm việc nhóm hoặc gửi cho mentor/khách hàng xem.
* **Triển khai:**
    * Nút **Share Public Link**: Tạo link readonly để người khác vào xem sơ đồ và chạy thử query (không cho sửa).
    * Chế độ **Team Workspace**: Mời thành viên vào cùng sửa (Real-time collaboration như Figma - tính năng này rất khó, có thể để sau cùng).

### 8. Advanced Mock Data (Smart Seeding)
* **Nâng cấp:** Tích hợp module `Faker` (như chúng ta đã thảo luận trước đó) vào sâu hơn.
* **Logic:**
    * Tự động phát hiện quan hệ cha-con để sinh dữ liệu theo lô (Batch generation).
    * Cho phép user định nghĩa quy tắc (VD: cột `status` chỉ được random trong `['active', 'pending']`).