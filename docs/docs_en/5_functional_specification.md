# ROLE
You are a Senior Product Manager specializing in Developer Tools. Your task is to write a detailed **Functional Specification Document (PRD)** for the "Smart SQL Assistant & Performance Tuner" project.

# PROJECT CONTEXT
- **Product:** A web-based tool allowing developers to chat with their databases using AI, generate SQL, and analyze performance bottlenecks.
- **Users:** Backend Developers, DBAs, Data Analysts.
- **Tech Stack:** React (Frontend), FastAPI (Backend), PostgreSQL (Internal DB), Ollama (AI).

# OUTPUT REQUIREMENTS

Please define the detailed requirements for the following 4 modules. For each feature, list the **Input**, **Process**, and **Expected Output**.

## MODULE 1: Connection Management (The Foundation)
- **Feature 1.1:** Add New Connection (Support PostgreSQL/MySQL).
  - *Constraint:* Passwords must be encrypted before storage.
- **Feature 1.2:** Schema Introspection (Sync).
  - *Logic:* Automatically fetch Table names, Columns, and Foreign Keys upon connection.
  - *Constraint:* Read-only metadata access only (No data rows fetching).

## MODULE 2: AI SQL Assistant (The Chatbot)
- **Feature 2.1:** Context-Aware Chat.
  - *Logic:* Inject the selected DB Schema into the System Prompt.
- **Feature 2.2:** Text-to-SQL Generation.
  - *Logic:* Convert natural language to SQL.
- **Feature 2.3:** SQL Execution & Safety.
  - *Logic:* Execute Read queries (SELECT). Block or warn on Write queries (DROP, DELETE, UPDATE).

## MODULE 3: Performance Tuner (The Core Value)
- **Feature 3.1:** Query Plan Visualization.
  - *Logic:* Run `EXPLAIN (ANALYZE, FORMAT JSON)`. Parse JSON to extract 'Total Cost', 'Execution Time'.
- **Feature 3.2:** AI Optimization Advisor.
  - *Logic:* AI analyzes the Query Plan + Schema to suggest Indexes or Query Rewrites.

## MODULE 4: Feedback Loop (For Fine-tuning)
- **Feature 4.1:** Rate & Correct.
  - *Logic:* User can vote (Like/Dislike) and edit the generated SQL if it's wrong.
  - *Goal:* Store 'Bad SQL' vs 'Corrected SQL' pairs for future model fine-tuning.