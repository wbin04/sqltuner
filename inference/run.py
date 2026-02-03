# flake8: noqa

from flask import Flask, request, jsonify, Response
from llama_cpp import Llama
import os
import json
import time

app = Flask(__name__)

MODEL_PATH = os.path.join("models", "qwen2.5-3b-instruct-q4_k_m.gguf")

print("Đang tải mô hình, vui lòng chờ...")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_threads=6,
    verbose=False
)
print("Mô hình đã tải xong!")


def format_chat_prompt(messages):
    prompt = ""
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            prompt += f"<|im_start|>system\n{content}\n<|im_end|>\n"
        elif role == "user":
            prompt += f"<|im_start|>user\n{content}\n<|im_end|>\n"
        elif role == "assistant":
            prompt += f"<|im_start|>assistant\n{content}\n<|im_end|>\n"

    prompt += "<|im_start|>assistant\n"
    return prompt


@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    prompt = data.get('prompt', '')
    model = data.get('model', 'qwen2.5:3b')
    stream = data.get('stream', False)
    options = data.get('options', {})

    temperature = options.get('temperature', 0.7)
    max_tokens = options.get('num_predict', 512)

    if stream:
        def generate_stream():
            output = llm(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["<|im_end|>", "<|im_start|>"],
                echo=False,
                stream=True
            )

            for chunk in output:
                response_data = {
                    "model": model,
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "response": chunk["choices"][0]["text"],
                    "done": False
                }
                yield json.dumps(response_data) + "\n"

            final_data = {
                "model": model,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "response": "",
                "done": True
            }
            yield json.dumps(final_data) + "\n"

        return Response(generate_stream(), mimetype='application/x-ndjson')
    else:
        output = llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=["<|im_end|>", "<|im_start|>"],
            echo=False
        )

        response_text = output["choices"][0]["text"].strip()

        return jsonify({
            "model": model,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "response": response_text,
            "done": True
        })


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    model = data.get('model', 'qwen2.5:3b')
    stream = data.get('stream', False)
    options = data.get('options', {})

    temperature = options.get('temperature', 0.7)
    max_tokens = options.get('num_predict', 512)

    prompt = format_chat_prompt(messages)

    if stream:
        def chat_stream():
            output = llm(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["<|im_end|>", "<|im_start|>"],
                echo=False,
                stream=True
            )

            for chunk in output:
                response_data = {
                    "model": model,
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "message": {
                        "role": "assistant",
                        "content": chunk["choices"][0]["text"]
                    },
                    "done": False
                }
                yield json.dumps(response_data) + "\n"

            final_data = {
                "model": model,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "message": {
                    "role": "assistant",
                    "content": ""
                },
                "done": True
            }
            yield json.dumps(final_data) + "\n"

        return Response(chat_stream(), mimetype='application/x-ndjson')
    else:
        output = llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=["<|im_end|>", "<|im_start|>"],
            echo=False
        )

        response_text = output["choices"][0]["text"].strip()

        return jsonify({
            "model": model,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "message": {
                "role": "assistant",
                "content": response_text
            },
            "done": True
        })


@app.route('/api/tags', methods=['GET'])
def tags():
    return jsonify({
        "models": [
            {
                "name": "qwen2.5:3b",
                "model": "qwen2.5:3b",
                "modified_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "size": os.path.getsize(MODEL_PATH) if os.path.exists(MODEL_PATH) else 0,
                "digest": "qwen2.5-3b-instruct",
                "details": {
                    "format": "gguf",
                    "family": "qwen2.5",
                    "parameter_size": "3B",
                    "quantization_level": "Q4_K_M"
                }
            }
        ]
    })


@app.route('/api/show', methods=['POST'])
def show():
    data = request.json
    model = data.get('name', 'qwen2.5:3b')

    return jsonify({
        "modelfile": "# Qwen2.5 3B Instruct\nFROM qwen2.5-3b-instruct-q4_k_m.gguf",
        "parameters": "temperature 0.7\nnum_ctx 2048",
        "template": "<|im_start|>system\n{{ .System }}\n<|im_end|>\n<|im_start|>user\n{{ .Prompt }}\n<|im_end|>\n<|im_start|>assistant\n",
        "details": {
            "format": "gguf",
            "family": "qwen2.5",
            "parameter_size": "3B",
            "quantization_level": "Q4_K_M"
        }
    })


@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "status": "ok",
        "message": "Ollama-compatible server is running",
        "model": "qwen2.5:3b"
    })


if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 Ollama-compatible server starting...")
    print("📍 Server URL: http://localhost:11434")
    print("📚 Available endpoints:")
    print("   - POST /api/generate")
    print("   - POST /api/chat")
    print("   - GET  /api/tags")
    print("   - POST /api/show")
    print("="*50 + "\n")
    # Quoc_Huy_2004
    app.run(host='0.0.0.0', port=11434, debug=False)
