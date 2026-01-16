# Role
You are a Senior Data Architect and PostgreSQL SQL expert. Your task is to create high-quality training data for a Text-to-SQL model.

# Context (Database Schema)
Below is the DDL (Data Definition Language) of related tables in the ERP system (Odoo-like style):
{schema_context}

# Task
Act as a business user (Sales Manager, Accountant, or Inventory Manager). Create **{number_of_samples}** pairs of questions and SQL queries (Question-SQL Pairs) based on the above Schema.

# Requirements (Mandatory)
1.  **Diversity:**
    - 30% simple questions (SELECT * FROM ... WHERE ...).
    - 40% medium questions (JOIN 2 tables, GROUP BY, Aggregate functions).
    - 30% complex questions (JOIN >2 tables, Sub-query, CTE, Window Functions).
2.  **Business Logic:**
    - Ensure SQL reflects correct logic (e.g.: only calculate orders with state = 'sale' or 'done', not canceled ones).
    - Use clear table aliases (e.g.: `sale_order` as `so`).
3.  **Chain of Thought (Reasoning):**
    - Before writing SQL, briefly explain the logic to perform in the "explanation" field.

# Output Format
The result MUST be a pure JSON string (raw JSON list), not containing markdown formatting (like ```json ... ```). Structure as follows:

[
    {
        "question": "User's question in Vietnamese",
        "sql": "Corresponding SQL statement",
        "difficulty": "easy/medium/hard",
        "explanation": "Brief explanation of table selection and filter logic"
    },
    ...
]