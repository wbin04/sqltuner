import requests

# Gửi yêu cầu ép model xả khỏi RAM ngay lập tức
payload = {
    "model": "qwen2.5:3b", 
    "keep_alive": 0  # <--- Số 0 nghĩa là UNLOAD NGAY LẬP TỨC
}

try:
    requests.post("http://localhost:11434/api/generate", json=payload)
    print("✅ Đã giải phóng RAM thành công!")
except Exception as e:
    print(f"Lỗi: {e}")