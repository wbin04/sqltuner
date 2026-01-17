import requests
import json
import time

# Cấu hình API của Ollama local
url = "http://localhost:11434/api/generate"

# --- 1. GIẢ LẬP INPUT ---

# Định nghĩa Schema Database (Đây là ngữ cảnh bắt buộc)
# Ví dụ: Một DB quản lý nhân sự đơn giản
db_schema = """
CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    department_id INT,
    salary DECIMAL(10, 2),
    hire_date DATE
);

CREATE TABLE departments (
    dept_id INT PRIMARY KEY,
    dept_name VARCHAR(50),
    location VARCHAR(100)
);
"""

# Câu hỏi của bạn (Tiếng Việt hoặc Anh đều được, nhưng Anh tốt hơn cho base model này)
# Ta thử tiếng Việt luôn xem khả năng của nó
question = "Tìm tên và lương của những nhân viên thuộc phòng IT có lương trên 2000"

# --- 2. GỌI OLLAMA ---

payload = {
    "model": "sqlcoder-thesis",
    "prompt": question,
    "system": db_schema,
    "stream": False,
    "options": {
        "num_ctx": 1024,    # Giảm cửa sổ ngữ cảnh (Mặc định là 2048/4096). 
                            # Schema của bạn ngắn, để 1024 là quá đủ và giúp xử lý đầu vào nhanh hơn.
        
        "num_thread": 4,    # Quan trọng: Số luồng CPU sử dụng. 
                            # Mẹo: Hãy set bằng số nhân VẬT LÝ (Physical Cores) của máy bạn - 1.
                            # Ví dụ: Chip 4 nhân thì để 3 hoặc 4. Đừng để quá cao sẽ bị chậm đi.
        
        "temperature": 0.0  # Giữ nguyên để chính xác
    }
}
print(f"Đang gửi câu hỏi tới CPU... (Question: {question})")
start_time = time.time()

try:
    response = requests.post(url, json=payload)
    response_data = response.json()
    
    end_time = time.time()
    
    # --- 3. KẾT QUẢ ---
    print("\n" + "="*40)
    print("KẾT QUẢ SQL SINH RA:")
    print("="*40)
    
    # Lấy phần code SQL từ phản hồi
    sql_result = response_data.get('response', '')
    print(sql_result)
    
    print("-" * 40)
    print(f"Thời gian xử lý: {end_time - start_time:.2f} giây")

except Exception as e:
    print(f"Lỗi: {e}")