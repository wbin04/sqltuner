import requests

payload = {
    "model": "qwen2.5:3b", 
    "keep_alive": 0
}

try:
    requests.post("http://localhost:11434/api/generate", json=payload)
    print("Model reset request sent successfully.")
except Exception as e:
    print(f"Error: {e}")
