```sql
-- Kích hoạt extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tạo các kiểu ENUM
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE db_type AS ENUM ('postgres', 'mysql');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');

-- 2. Bảng Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng DB Connections
CREATE TABLE db_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 5432,
    username VARCHAR(100),
    encrypted_password VARCHAR(500) NOT NULL,
    db_name VARCHAR(100) NOT NULL,
    db_type db_type DEFAULT 'postgres',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_connections_user ON db_connections(user_id);

-- 4. Bảng Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES db_connections(id) ON DELETE SET NULL,
    title VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conversations_conn ON conversations(connection_id);

-- 5. Bảng Query Logs (Lịch sử chat)
CREATE TABLE query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role chat_role NOT NULL,
    content TEXT NOT NULL,
    sql_generated TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_logs_conversation ON query_logs(conversation_id);

-- 6. Bảng Feedbacks (Dữ liệu Fine-tune)
CREATE TABLE feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_log_id UUID NOT NULL UNIQUE REFERENCES query_logs(id) ON DELETE CASCADE,
    rating INT,
    corrected_sql TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng Performance Analysis (Lưu kết quả Explain)
CREATE TABLE performance_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_log_id UUID NOT NULL UNIQUE REFERENCES query_logs(id) ON DELETE CASCADE,
    execution_time_ms FLOAT,
    total_cost FLOAT,
    explain_plan JSONB NOT NULL,
    index_recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tạo Index cho JSONB để sau này query nhanh các node Seq Scan
CREATE INDEX idx_explain_plan ON performance_analysis USING gin (explain_plan);
```