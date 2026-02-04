# PROJECT SPECIFICATION DOCUMENT
**SQLTuner - AI-Powered SQL Query Optimization System**

---

**Document Version:** 1.0  
**Date:** February 4, 2026  
**Author:** Nguyễn Lê Quốc Huy
**Project Type:** University Graduation Thesis  
**Academic Level:** Bachelor of Information Technology

---

## EXECUTIVE SUMMARY

SQLTuner is an AI-powered web application designed to optimize SQL query performance through intelligent analysis and automated recommendations. This project originated from a critical observation during an internship training period at a technology company, where manual database performance tuning consumed significant developer time and required specialized expertise that junior team members lacked.

**Key Innovation:** The system leverages local Large Language Models (LLM) to democratize database optimization knowledge, making advanced performance tuning accessible to developers at all skill levels while maintaining data security through local processing.

---

## 1. INTRODUCTION & BACKGROUND

### 1.1 Project Genesis: The Internship Experience

This project did not emerge from theoretical academic requirements but was directly inspired by practical challenges observed during the **internship training period** at a software development company specializing in data-intensive applications.

**The Observation Scenario:**
During the onboarding phase with the **Backend Development Team**, I was trained on the company's standard workflow for handling database performance issues. The existing process required developers to:

1. Manually identify slow-running queries from application logs
2. Copy the problematic SQL statement into a database client
3. Execute `EXPLAIN ANALYZE` commands manually
4. Interpret complex execution plans (often taking 30-60 minutes per query)
5. Search through documentation or consult senior DBAs for optimization strategies
6. Manually test index recommendations and query rewrites
7. Document findings in scattered Excel sheets or wiki pages

**The Critical Question:**
While observing a senior developer spend over 2 hours analyzing a single slow query, I raised a fundamental question to my mentor:

> *"Is there any way to optimize this workflow to save time and reduce the dependency on senior expertise? Could we automate the analysis and get AI-powered recommendations?"*

**The Response & Project Inception:**
This question sparked discussions with the technical lead, who acknowledged that:
- **70% of query optimization follows predictable patterns** (missing indexes, suboptimal joins, sequential scans)
- **Junior developers lack confidence** in performance tuning due to knowledge gaps
- **No centralized tool existed** that combined SQL execution, AI analysis, and learning resources

This practical need became the foundation for the SQLTuner graduation project: **building an intelligent assistant that transforms database optimization from an expert-only task into an accessible, guided process for all developers.**

### 1.2 Real-World Impact

The inefficiencies observed during the internship had measurable business impacts:

- **Time Waste:** Developers spent an average of 8-10 hours per week on manual query optimization
- **Inconsistent Quality:** Optimization approaches varied wildly between developers
- **Security Concerns:** Sending queries to external AI services violated company data policies

---

## 2. PROBLEM STATEMENT & OBJECTIVES

### 2.1 Primary Problem

**Manual SQL optimization is inefficient, requires specialized expertise, and lacks accessibility for junior developers, leading to degraded application performance and prolonged development cycles.**

### 2.2 Specific Pain Points Identified

| Pain Point | Current Impact | Desired State |
|------------|----------------|---------------|
| **Knowledge Gap** | Junior developers cannot interpret `EXPLAIN` plans | AI provides guided analysis with explanations |
| **Time Consumption** | 30-90 min per query analysis | Reduce to 5-10 minutes with automated insights |
| **Lack of Context** | Optimization requires manual schema review | Auto-sync schema metadata for context-aware suggestions |
| **No Learning Path** | Trial-and-error without educational feedback | System explains *why* optimizations work |
| **Security Risks** | External AI services expose sensitive queries | Use local LLM to keep data on-premises |
| **Poor Documentation** | Optimization history lost in scattered files | Centralized history with searchable records |

### 2.3 Project Objectives

**Primary Objectives:**
1. **Automate Query Analysis** - Reduce manual interpretation time by 80%
2. **Democratize Expertise** - Enable junior developers to perform intermediate-level optimization
3. **Ensure Data Security** - Process all queries locally without external API dependencies
4. **Educational Value** - Provide explanations that build developer competency over time

**Secondary Objectives:**
1. Create a conversational interface for natural language database queries
2. Implement schema visualization for understanding table relationships
3. Build a simulation sandbox for testing optimization strategies safely
4. Track optimization history for continuous learning

### 2.4 Success Metrics

**Quantitative Metrics:**
- Reduce average query optimization time from **45 minutes to <10 minutes**
- Achieve **≥80% accuracy** in identifying performance bottlenecks
- Support **PostgreSQL and MySQL** database systems
- Process queries with **<5 second latency** for AI recommendations

**Qualitative Metrics:**
- Junior developers can independently optimize queries without senior assistance
- System explanations are clear and actionable
- Users report increased confidence in database performance tuning

---

## 3. PROJECT SCOPE

### 3.1 In-Scope Features

**Module 1: Database Connection Management**
- Multi-database support (PostgreSQL, MySQL, SQL Server)
- Encrypted credential storage using Fernet encryption
- Automatic schema introspection and synchronization
- Connection health monitoring

**Module 2: AI-Powered Chat Interface**
- Natural language to SQL query generation
- Context-aware responses using schema metadata
- Conversation history and session management
- Support for clarification and iterative refinement

**Module 3: Query Optimization Engine**
- Automated `EXPLAIN ANALYZE` execution
- Query plan visualization and cost analysis
- AI-powered bottleneck identification
- Index recommendations with rationale
- Query rewrite suggestions
- Before/after performance comparison

**Module 4: SQLite Simulation Sandbox**
- Safe query testing environment
- Schema structure editor (create tables, indexes)
- Sample data generation for testing
- Hypothetical index testing (using HypoPG for PostgreSQL)

**Module 5: History & Analytics**
- Query execution history tracking
- Optimization feedback loop (user ratings)
- Searchable archive of previous analyses

**Module 6: Admin Dashboard**
- User management (CRUD operations)
- Feedback review and quality monitoring
- System usage statistics

### 3.2 Out-of-Scope Features

**Explicitly Excluded (Future Enhancements):**
- Automated query execution on production databases (read-only mode only)
- Real-time monitoring and alerting
- Support for NoSQL databases (MongoDB, Cassandra)
- Multi-cloud deployment automation
- Custom LLM fine-tuning interface
- Advanced RBAC (role-based access control) beyond admin/user
- Integration with CI/CD pipelines
- Support for Oracle, SQL Server (limited to PostgreSQL/MySQL)

### 3.3 Phase 3 Roadmap: Developer Tools Extensions

**Extensions Planned:**
- **VS Code Extension** - IDE integration for inline optimization

**Integration Strategy:**
This extension will communicate with the same backend API (FastAPI), ensuring:
- Unified authentication (single account across all tools)
- Synchronized schema metadata and optimization history
- Consistent AI recommendation engine
- Centralized billing and usage tracking

---

## 4. DETAILED FUNCTIONAL REQUIREMENTS

### **4.1: Database Connection Management**

**FR-1.1: Add New Connection**
- **Input:** Database type, hostname, port, username, password, database name
- **Process:**
  1. Validate connection parameters (test connection)
  2. Encrypt password using Fernet symmetric encryption
  3. Store encrypted credentials in internal PostgreSQL database
- **Output:** Success confirmation with connection ID
- **Validation Rules:**
  - Host must be reachable via TCP
  - Username/password must authenticate successfully
  - Database name must exist
- **Error Handling:** Display clear error messages for connection failures

**FR-1.2: Schema Introspection**
- **Input:** Selected database connection ID
- **Process:**
  1. Decrypt stored credentials
  2. Establish read-only connection to target database
  3. Query system catalogs (pg_catalog for PostgreSQL, information_schema for MySQL)
  4. Extract: table names, column names, data types, primary keys, foreign keys, indexes
  5. Store schema metadata as JSONB in internal database
- **Output:** JSON schema structure
- **Constraints:**
  - Read-only access (no write permissions required)
  - Metadata only (no data rows fetched)
  - Automatic re-sync on user request

### **4.2: AI Chat Assistant**

**FR-2.1: Natural Language Query Generation**
- **Input:** User's text question (e.g., "Show me all customers who ordered in the last 30 days")
- **Process:**
  1. Inject current database schema into system prompt
  2. Send user question + schema context to local LLM (Ollama)
  3. Parse LLM response to extract SQL query
- **Output:** Executable SQL query with explanation
- **Validation:**
  - Verify generated SQL syntax using SQLGlot parser
  - Warn if query contains destructive operations (DELETE, DROP, TRUNCATE)

**FR-2.2: Conversational Context Management**
- **Input:** Follow-up question referencing previous exchange
- **Process:**
  1. Maintain conversation history in database
  2. Include last 5 messages in LLM prompt for context
  3. Support clarifications ("Add a WHERE clause for active users")
- **Output:** Updated SQL query maintaining previous context

**FR-2.3: SQL Execution Safety**
- **Input:** User requests to execute generated SQL
- **Process:**
  1. Analyze query type (read vs. write operation)
  2. Allow SELECT queries automatically
  3. Block or require explicit confirmation for INSERT/UPDATE/DELETE
  4. Execute query with timeout (30 seconds max)
- **Output:** Query results (max 1000 rows) or error message

### **4.3: Query Optimization Engine**

**FR-3.1: Automated Performance Analysis**
- **Input:** SQL query + connection ID
- **Process:**
  1. Execute `EXPLAIN (ANALYZE, FORMAT JSON)` on target database
  2. Parse JSON execution plan
  3. Extract key metrics:
     - Total cost estimation
     - Actual execution time
     - Rows scanned vs. rows returned (selectivity)
     - Node types (Seq Scan, Index Scan, Hash Join, etc.)
  4. Identify bottlenecks:
     - Sequential scans on large tables (>10,000 rows)
     - High-cost nodes (>1000 cost units)
     - Inefficient join methods
- **Output:** Structured performance report with bottleneck highlights

**FR-3.2: AI Optimization Recommendations**
- **Input:** Execution plan + schema metadata + original query
- **Process:**
  1. Construct optimization prompt:
     ```
     You are a PostgreSQL performance expert.
     Schema: [tables + columns + existing indexes]
     Query: [user's SQL]
     Execution Plan: [JSON plan]
     Task: Suggest specific indexes or query rewrites to improve performance.
     ```
  2. Send to LLM (SQLCoder model optimized for SQL tasks)
  3. Parse LLM response using structured output format:
     ```json
     {
       "optimized_sql": "REWRITTEN QUERY",
       "index_recommendations": [
         {
           "table": "orders",
           "columns": ["customer_id", "order_date"],
           "type": "btree",
           "rationale": "Speeds up WHERE clause filtering"
         }
       ],
       "explanation": "The original query uses a sequential scan..."
     }
     ```
- **Output:** Actionable recommendations with cost comparison

**FR-3.3: Index Impact Simulation**
- **Input:** Recommended index DDL statement
- **Process (PostgreSQL only):**
  1. Use HypoPG extension to create hypothetical index
  2. Re-run `EXPLAIN` with hypothetical index active
  3. Compare costs: original vs. optimized
  4. Calculate estimated improvement percentage
- **Output:** Before/after performance comparison
- **Limitation:** MySQL requires manual testing (HypoPG not available)

### **4.4: SQLite Simulation Sandbox**

**FR-4.1: Schema Structure Editor**
- **Input:** Table definitions (name, columns, data types, constraints)
- **Process:**
  1. Validate DDL syntax
  2. Create tables in isolated SQLite database (in-memory or file-based)
  3. Support foreign keys, primary keys, unique constraints
- **Output:** Sandbox schema ready for testing

**FR-4.2: Sample Data Generation**
- **Input:** Table name, number of rows
- **Process:**
  1. Generate realistic sample data based on column types:
     - VARCHAR → Random names/cities (Faker library)
     - INTEGER → Random numbers within realistic ranges
     - DATE → Random dates within specified period
  2. Insert data into sandbox tables
- **Output:** Populated test database

**FR-4.3: Safe Query Testing**
- **Input:** SQL query to test
- **Process:**
  1. Execute query against sandbox database
  2. Measure execution time
  3. Show EXPLAIN output
  4. Allow iterative modification and re-testing
- **Output:** Query results without production risk

### **4.5: History & Feedback**

**FR-5.1: Query History Tracking**
- **Input:** All executed queries (automatic)
- **Process:**
  1. Log each query with metadata:
     - Timestamp
     - User ID
     - Connection ID
     - Execution time
     - Success/failure status
  2. Store optimization recommendations
  3. Link to conversation context
- **Output:** Searchable history log

**FR-5.2: Feedback Collection**
- **Input:** User rating (like/dislike) + optional comments
- **Process:**
  1. Associate feedback with specific query log entry
  2. Store corrected SQL if user edited the AI-generated query
  3. Flag low-quality responses for admin review
- **Output:** Dataset for future model fine-tuning

**FR-5.3: Search & Replay**
- **Input:** Search filters (date range, query text, connection)
- **Process:**
  1. Query history database with full-text search
  2. Retrieve matching records
  3. Allow user to re-run previous queries
- **Output:** Filtered history results

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| **AI Response Latency** | <10 seconds | End-to-end time from query submission to recommendation display |
| **Schema Sync Speed** | <30 seconds | Time to introspect and store metadata |
| **Query Execution Timeout** | 60 seconds max | Automatic cancellation for long-running queries |
| **Database Query Performance** | <2000ms for history lookups | PostgreSQL query execution time |

### 5.2 Security Requirements

**SR-1: Credential Protection**
- All database passwords **MUST** be encrypted using Fernet (symmetric encryption)
- Encryption keys stored in environment variables (never in code)
- Decryption only occurs in-memory during active connection use

**SR-2: Authentication & Authorization**
- JWT-based authentication for API access
- Password hashing using bcrypt (12 rounds)
- Role-based access: `admin` and `user` roles
- Session expiration: 24 hours

**SR-3: Data Privacy**
- No query data sent to external APIs (local LLM only)
- User data isolation: users can only access their own connections
- Audit trail for admin actions (user management, feedback review)

**SR-4: SQL Injection Prevention**
- Use parameterized queries for all database interactions
- SQLGlot parser validation before execution
- Whitelist allowed SQL operations (SELECT, EXPLAIN)

### 5.3 Reliability & Availability

**Error Handling:**
- Graceful degradation if LLM service is unavailable (show error, not crash)
- Automatic retry for transient database connection failures (max 3 retries)
- User-friendly error messages (no stack traces shown to end users)

**Data Backup:**
- Internal PostgreSQL database backed up daily
- Schema metadata cached to recover from connection failures

---

## 6. TECHNICAL ARCHITECTURE

### 6.1 System Architecture Overview

**Deployment Model:** Monolithic application with microservice-style separation

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                       │
│              (React 18 + TypeScript)                    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS/HTTP
                     │
┌────────────────────▼────────────────────────────────────┐
│              Nginx Reverse Proxy (Optional)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              FastAPI Backend (Python 3.10)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Layer (REST endpoints)                      │   │
│  │  - /api/v1/connections                           │   │
│  │  - /api/v1/chat                                  │   │
│  │  - /api/v1/sql/optimize                          │   │
│  │  - /api/v1/history                               │   │
│  └─────────────────┬────────────────────────────────┘   │
│                    │                                    │
│  ┌─────────────────▼────────────────────────────────┐   │
│  │  Business Logic (Services)                       │   │
│  │  - OptimizationService                           │   │
│  │  - LLMService (Ollama integration)               │   │
│  │  - SchemaService (Introspection)                 │   │
│  │  - SimulationService (SQLite sandbox)            │   │
│  └─────────────────┬────────────────────────────────┘   │
│                    │                                    │
│  ┌─────────────────▼────────────────────────────────┐   │
│  │  Data Access Layer (Repositories)                │   │
│  │  - ConnectionRepository                          │   │
│  │  - ConversationRepository                        │   │
│  │  - QueryLogRepository                            │   │
│  └─────────────────┬────────────────────────────────┘   │
└────────────────────┼────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬────────────────┐
         │                       │                │
┌────────▼────────┐   ┌──────────▼──────┐  ┌──────▼──────┐
│  PostgreSQL 17  │   │  Ollama Server  │  │  Target DBs │
│  (Internal DB)  │   │  (Local LLM)    │  │ (User's DB) │
│  - Users        │   │  - SQLCoder     │  │ - Postgres  │
│  - Connections  │   │  - Llama 3.1    │  │ - MySQL     │
│  - Query Logs   │   │                 │  │             │
└─────────────────┘   └─────────────────┘  └─────────────┘
```

### 6.2 Technology Stack Justification

### **Frontend: React 18 + TypeScript**

**Why React?**
- **Component reusability:** Chat interface, SQL editor, schema tree use shared components
- **Rich ecosystem:** Libraries for syntax highlighting (CodeMirror), diff views, diagrams
- **Developer familiarity:** Most widely used framework (easy to maintain/extend)

**Why TypeScript?**
- **Type safety:** Prevents runtime errors in complex data structures (query plans, schemas)
- **Better IDE support:** Autocomplete for API responses and state management
- **Maintainability:** Easier to refactor as project grows

**Supporting Libraries:**
- **Vite:** Fast build tool (3-5x faster than Webpack)
- **TailwindCSS:** Utility-first CSS for rapid UI development + dark mode
- **Axios:** HTTP client with interceptors for JWT token handling
- **React Query (optional):** For caching API responses and optimistic updates

#### **Backend: Python 3.10 + FastAPI**

**Why Python?**
- **Rich database ecosystem:** SQLAlchemy (ORM), asyncpg (PostgreSQL), pymysql (MySQL)
- **AI/ML integration:** Native compatibility with LLM libraries (llama-cpp-python, Ollama SDK)
- **Rapid development:** Fast prototyping with dynamic typing and extensive libraries

**Why FastAPI?**
- **Modern async support:** Non-blocking I/O for database and LLM requests (critical for performance)
- **Auto-generated docs:** OpenAPI/Swagger UI out of the box (reduces documentation effort)
- **Type validation:** Pydantic schemas ensure API contract compliance
- **Performance:** Comparable to Node.js/Go (via Starlette ASGI framework)

**Key Libraries:**
- **SQLAlchemy 2.0:** Async ORM for internal database operations
- **Alembic:** Database migration management (version control for schema changes)
- **Cryptography (Fernet):** Symmetric encryption for database credentials
- **Httpx:** Async HTTP client for calling Ollama LLM API
- **SQLGlot:** SQL parser for syntax validation and dialect translation

#### **Database: PostgreSQL 17**

**Why PostgreSQL?**
- **Advanced JSONB:** Efficient storage and querying of schema metadata
- **HypoPG extension:** Allows hypothetical index testing without creating real indexes
- **Full-text search:** For query history search functionality
- **ACID compliance:** Ensures data integrity for user management and query logs
- **pgvector (future):** Potential for semantic search of similar queries using embeddings

**Schema Design:**
- **Users table:** Authentication and role management
- **DBConnections table:** Encrypted credentials + JSONB schema metadata
- **Conversations table:** Chat history with foreign key to connections
- **Messages table:** Individual chat messages (user/assistant roles)
- **QueryLogs table:** Execution history with performance metrics
- **PerformanceAnalysis table:** Optimization recommendations linked to query logs

#### **AI/LLM: Ollama + SQLCoder**

**Why Local LLM (not OpenAI/cloud)?**
- **Data privacy:** User queries may contain sensitive business logic/data
- **No API costs:** Zero per-request fees (important for academic/budget projects)
- **Offline capability:** Works without internet connection
- **Customization:** Potential to fine-tune model on company-specific patterns

**Why SQLCoder Model?**
- **Specialized training:** Fine-tuned specifically for SQL tasks (vs. general-purpose GPT)
- **Better accuracy:** Outperforms GPT-3.5 on SQL generation benchmarks
- **Reasonable size:** 7B-15B parameters (runs on consumer hardware with 16GB RAM)

**Ollama Benefits:**
- Simple API (OpenAI-compatible endpoints)
- Model version management
- GPU acceleration support (CUDA/Metal)

### 6.3 Architecture Patterns

**Repository Pattern:**
- Abstracts database access logic
- Each entity (User, Connection, QueryLog) has a dedicated repository
- Enables easy testing with mock repositories

**Service Layer Pattern:**
- Business logic separated from API controllers
- `OptimizationService` orchestrates: decrypt credentials → connect to DB → run EXPLAIN → call LLM
- Services are stateless and reusable

**Dependency Injection:**
- FastAPI's built-in DI for database sessions
- Simplifies testing and reduces coupling

---

## 7. USER INTERFACE DESIGN

### **Screen 1: Login Page**
- Simple email/password form
- "Remember me" checkbox (stores JWT in localStorage)
- Error messages for invalid credentials

### **Screen 2: Workspaces (Connections) Page**
- Card-based layout showing all database connections
- "+ Add Connection" button (opens modal)
- Each card shows: DB name, type (Postgres/MySQL), host, last sync time
- Actions: Edit, Delete, Test Connection

### **Screen 3: Chat Editor (Main Interface)**
- **Left Sidebar:** Schema tree view (collapsible tables → columns)
- **Center Panel:**
  - Chat message history (user questions + AI responses)
  - SQL code blocks with syntax highlighting
  - "Optimize" button next to each SQL query
- **Right Sidebar:** Schema diagram (visual relationships)
- **Bottom:** Input box for natural language questions

### **Screen 4: Optimization Modal**
- Triggered when clicking "Optimize" button
- **Tabs:**
  - **Analysis:** Original vs. optimized query (diff view)
  - **Recommendations:** Index suggestions with DDL statements
  - **Execution Plan:** Visual tree or table representation
  - **Performance:** Before/after cost comparison
- **Actions:** Copy DDL, Apply to Sandbox, Feedback

### **Screen 5: Simulation Sandbox**
- **Tables Sidebar:** List of sandbox tables
- **Structure Editor:** Create/modify tables and indexes
- **Data Editor:** Insert/edit sample rows
- **Query Tester:** Run queries and see EXPLAIN output

### **Screen 6: History Page**
- Filterable table of past query executions
- Columns: Date, Query (truncated), Database, Status, Execution Time
- Click row to expand full details
- Search bar with full-text search

### **Screen 7: Admin Dashboard**
- **User Management Tab:** CRUD table for users
- **Feedback Review Tab:** Low-rated queries flagged for review
- **Statistics:** Total users, total queries, average optimization time

---

## 8. TESTING STRATEGY

### 8.1 Unit Testing

**Backend (pytest):**
- Test each service method in isolation
- Mock database connections and LLM API calls
- Coverage target: 70% for business logic

**Frontend (Vitest + React Testing Library):**
- Test component rendering and user interactions
- Mock API responses using MSW (Mock Service Worker)

### 8.2 Integration Testing

**Database Tests:**
- Test schema introspection against real PostgreSQL/MySQL instances
- Verify encryption/decryption of credentials

**LLM Integration:**
- Test prompt construction and response parsing
- Handle edge cases (LLM timeouts, malformed JSON responses)

### 8.3 User Acceptance Testing (UAT)

**Test Scenarios:**
1. **New User Onboarding:** Can a user with zero experience add a connection and optimize a query in <15 minutes?
2. **Optimization Accuracy:** Do recommended indexes actually improve query performance?
3. **Security:** Can users access other users' connections? (should fail)

---

## 9. DEPLOYMENT PLAN - DOCKER DEPLOYMENT

**Services:**
1. **PostgreSQL Container:** Internal database
2. **Backend Container:** FastAPI app
3. **Frontend Container (optional):** Nginx serving React build
4. **Ollama Container:** LLM inference server
---

## 10. RISK MANAGEMENT

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **LLM hallucination** (generates invalid SQL) | High | Medium | - Validate with SQLGlot parser<br>- Show warnings for untested queries<br>- Require user confirmation before execution |
| **Performance bottleneck** (LLM inference slow) | Medium | High | - Cache common optimization patterns<br>- Implement query queuing<br>- Use faster model (7B instead of 13B) |
| **Database credential leak** | Low | Critical | - Encrypt all passwords with Fernet<br>- Store keys in environment variables<br>- Audit logging for credential access |
| **Inaccurate optimization advice** | Medium | Medium | - Collect user feedback (thumbs up/down)<br>- Review flagged low-quality responses<br>- Continuous prompt engineering |
| **Timeline overrun** | Medium | High | - Prioritize core features (defer sandbox to Phase 2)<br>- Weekly progress reviews with advisor<br>- Use MVP approach |

---

## 11. FUTURE ENHANCEMENTS

### 11.1 Phase 2 Features (Core Platform)
- Real-time query monitoring and alerting
- Custom LLM fine-tuning on user's historical query patterns
- Advanced RBAC with team-based workspaces
- Query performance regression detection

### 11.2 Developer Tools Extensions: VS Code Extension

**Purpose:** Bring AI-powered SQL optimization directly into the developer's IDE workflow without context switching.

**Key Features:**

**1. Inline SQL Optimization**
- **Auto-detect SQL queries** in code files (JavaScript, Python, Java, C#)
  - Recognize SQL strings in:
    ```python
    query = "SELECT * FROM users WHERE age > 25"
    db.execute("SELECT * FROM orders WHERE status = 'pending'")
    ```
- **CodeLens suggestions** above SQL strings:
  ```
  Optimize this query | Explain Plan | Test in Sandbox
  ```
- **Hover tooltips** showing:
  - Estimated query cost (if schema is known)
  - Potential missing indexes
  - Quick optimization tips

**2. Schema Explorer Sidebar**
- Tree view of connected databases (synced from SQLTuner web app)
- Right-click table → "Generate SELECT query"
- Drag-and-drop table/column names into editor
- Show column types, constraints, and indexes inline

**3. Query Performance Warnings**
- Real-time linting for common anti-patterns:
  - `SELECT *` warnings (suggest explicit columns)
  - Missing `WHERE` clause on large tables
  - `N+1 query` detection in ORM code
  - Suboptimal `JOIN` order suggestions
- Squiggly underlines with quick fixes:
  ```python
  query = "SELECT * FROM orders"  # Warning: SELECT * on large table
          └─ Quick fix: Replace with explicit columns
  ```

**4. AI Chat Panel**
- Integrated chat interface (same as web app)
- Ask questions without leaving VS Code:
  - "How do I optimize this JOIN?"
  - "Generate a query to find duplicate emails"
- **Context-aware**: Automatically includes:
  - Current file's SQL queries
  - Project's database schema (from `.env` or config)
  - Selected code snippet

**5. Testing & Debugging**
- **Run Query** button in editor gutter
- Results shown in output panel (formatted table)
- `EXPLAIN ANALYZE` visualization in webview panel
- Sandbox testing: "Test with 10K sample rows"

**6. Snippet Library**
- Pre-built optimization patterns:
  - Common index templates
  - Window function examples
  - CTE (Common Table Expression) refactoring
- User's personal snippet collection (synced from web app history)

**Technical Implementation:**
- **Language Server Protocol (LSP):** For SQL syntax highlighting and completion
- **WebView API:** Embed schema diagrams and EXPLAIN plan visualizations
- **Authentication:** OAuth to connect with SQLTuner web backend
- **Offline mode:** Cache schema metadata for offline suggestions

---

## 12. REFERENCES

**Technical Documentation:**
- PostgreSQL Official Documentation: https://www.postgresql.org/docs/
- FastAPI Documentation: https://fastapi.tiangolo.com/
- Ollama API Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
- SQLCoder Model: https://huggingface.co/defog/sqlcoder

---
