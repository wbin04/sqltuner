# SQLCoder Model Setup Guide with Ollama

## Overview
SQLCoder is a language model optimized to generate accurate SQL queries from natural language questions. This guide will help you set up the SQLCoder model using Ollama on your computer.

## System Requirements
- Operating System: Windows, macOS, or Linux
- RAM: Minimum 8GB (16GB+ recommended)
- Storage: Approximately 4GB for the Q4_K_M model

## Step 1: Install Ollama
Ollama is a tool for running large language models (LLMs) locally on your computer.

1. Visit the official Ollama website: [ollama.ai](https://ollama.ai)
2. Download and install the version suitable for your operating system
3. Start Ollama after installation

## Step 2: Download SQLCoder Model
The SQLCoder model is already prepared in this directory in GGUF format.

- Model file: `sqlcoder-7b.Q4_K_M.gguf`
- Source: [Hugging Face - TheBloke/sqlcoder-7B-GGUF](https://huggingface.co/TheBloke/sqlcoder-7B-GGUF)

If you need to download from the source, use the link above.

## Step 3: Create Model with Ollama
Use the pre-configured `Modelfile` to create the model in Ollama.

1. Open terminal or command prompt
2. Navigate to the directory containing the `Modelfile`:
   ```
   cd path/to/sqlcoder_model
   ```
3. Run the model creation command:
   ```
   ollama create sqlcoder-thesis -f Modelfile
   ```

This command will:
- Use the downloaded GGUF file
- Set temperature = 0.0 to ensure accuracy
- Configure the conversation template suitable for SQL generation

## Step 4: Test the Model
Run the test script to verify the model works correctly.

```
python test_model.py
```

## Sample Output
After successful execution, you will get a SQL query similar to the following:

```sql
SELECT t1.first_name, t1.last_name, t1.salary
FROM employees AS t1
JOIN departments AS t2 ON t1.department_id = t2.dept_id
WHERE t2.dept_name = 'IT' AND t1.salary > 2000;
```

## Using the Model
After setup, you can use the model through Ollama CLI:

```
ollama run sqlcoder-thesis
```

Or integrate it into your application using Ollama's API.

## Notes
- Ensure the `sqlcoder-7b.Q4_K_M.gguf` file is in the same directory as the `Modelfile`
- If you encounter errors, check if Ollama is installed and running
- This model is optimized for SQL generation and not suitable for other tasks