# ROLE
You are a Senior Database Administrator and Python Developer. Your task is to design the Internal Database Schema for the "SQLTuner" application using SQLAlchemy.

# PROJECT CONTEXT
- **Database Engine:** PostgreSQL 15+.
- **Purpose:** Store user accounts, database connection configs, chat history, and performance analysis logs.
- **ORM:** SQLAlchemy (Async).

# OUTPUT REQUIREMENTS

## PART 1: ER Diagram
Generate a Mermaid.js ER Diagram containing these entities:
- `User` (Authentication).
- `DBConnection` (Stores credentials for target databases).
- `Conversation` (Chat threads).
- `QueryLog` (Individual messages/queries within a thread).
- `Feedback` (User rating for AI responses - Critical for fine-tuning).
- `PerformanceAnalysis` (Stores JSON Explain Plans and cost metrics).

## PART 2: SQLAlchemy Models (Python Code)
Write the actual Python code (using `sqlalchemy.orm.DeclarativeBase`) for the models.
- **Requirements:**
  - Use `UUID` for all Primary Keys.
  - Use `JSONB` for storing `explain_result` in `PerformanceAnalysis` table.
  - Use `EncryptedString` concept (or clear comments) for `DBConnection.password`.
  - Define all `relationship()` (One-to-Many) correctly.

## PART 3: SQL DDL Script
Provide the raw `CREATE TABLE` SQL script corresponding to the models above, ensuring:
- Indexes are created on Foreign Keys (e.g., `user_id`, `conversation_id`).
- `created_at` fields have default `NOW()`.
- Enums are defined for `Role` ('user', 'assistant') and `DBType` ('postgres', 'mysql').