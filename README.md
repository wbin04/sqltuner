# SQLTuner

AI-powered SQL optimization and analysis system using local LLM with database schema synchronization capabilities.

## Tech Stack

**Backend**
- Python 3.10 with FastAPI
- SQLAlchemy (async ORM) + Alembic migrations
- PostgreSQL 17 with pgvector and hypopg extensions
- Cryptography for secure credential storage
- Httpx for LLM API communication

**Frontend**
- React 18 + TypeScript
- Vite build tool
- TailwindCSS
- Axios HTTP client

**AI/LLM**
- Ollama local LLM server
- SQLCoder model for SQL optimization

## Quick Start with Docker

```bash
# Clone repository
git clone https://github.com/wbin04/SQLTuner.git
cd SQLTuner

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"
# Generate ENCRYPTION_KEY
python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"

# Start all services
docker-compose up --build -d

# Check status
curl http://localhost:8000/health

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

Services:
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Frontend (if configured): http://localhost:5173

## Project Structure

```
SQLTuner/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/v1/           # API endpoints
│   │   │   └── endpoints/
│   │   │       ├── connections.py    # DB connection management
│   │   │       ├── sql.py            # SQL optimization
│   │   │       └── db_inspector.py   # Schema inspection
│   │   ├── core/             # Configuration and security
│   │   ├── db/               # Database session management
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Business logic
│   │       ├── schema_service.py     # Schema sync service
│   │       ├── llm_service.py        # LLM integration
│   │       └── inspector_service.py  # DB inspection
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── lib/              # Axios configuration
│   │   ├── types/            # TypeScript types
│   │   └── App.tsx           # Main component
│   └── package.json
│
├── docker/
│   ├── backend/              # Backend Dockerfile
│   └── database/             # PostgreSQL with extensions
│
└── docs/
    ├── docs_en/              # English documentation
    ├── docs_vi/              # Vietnamese documentation
    ├── notebook/             # Jupyter notebooks
    └── sqlcoder_model/       # SQLCoder model files
```

## Key Features

- Database connection management with encrypted credentials
- Schema synchronization from target databases (PostgreSQL, MySQL)
- LLM-optimized schema caching for context
- SQL query optimization using AI
- SQL query explanation
- Database schema inspection
