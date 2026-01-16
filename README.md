# Smart SQL Tuner

AI-powered SQL optimization system using Local LLM (Ollama). This application helps optimize SQL queries, explain query logic, and inspect database structures using artificial intelligence.

## 🏗️ Tech Stack

### Backend
- **Python 3.10+** - Programming language
- **FastAPI** - Modern web framework
- **SQLAlchemy** - Async ORM
- **Alembic** - Database migrations
- **Asyncpg** - PostgreSQL async driver
- **Httpx** - Async HTTP client for LLM integration
- **Uvicorn** - ASGI server

### Frontend
- **React 18+** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool
- **TailwindCSS** - Utility-first CSS framework
- **Axios** - HTTP client

### AI/LLM
- **Ollama** - Local LLM server
- **SQLCoder** - SQL-specialized language model

## 📋 Prerequisites

Before starting, ensure you have:

1. **Python 3.10+** installed
2. **Node.js 18+** and npm installed
3. **PostgreSQL** database running
4. **Ollama** running at `http://localhost:11434`
5. **SQLCoder model** loaded in Ollama

### Setting up Ollama and SQLCoder

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai/

# Pull and run SQLCoder model
ollama pull sqlcoder-thesis

# Verify model is available
ollama list
```

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SQLTuner
```

### 2. Backend Setup

#### Step 1: Create Python Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate
```

#### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

#### Step 3: Configure Environment Variables

```bash
# Copy example environment file
copy .env.example .env

# Edit .env file with your settings
```

**.env Configuration:**
```env
API_V1_STR=/api/v1
PROJECT_NAME=SQLTuner

# PostgreSQL Database
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_DB=sqltuner_db

# Ollama LLM Settings
OLLAMA_BASE_URL=http://localhost:11434
MODEL_NAME=sqlcoder-thesis
```

#### Step 4: Initialize Database

```bash
# Create database (if not exists)
# Connect to PostgreSQL and run:
# CREATE DATABASE sqltuner;

# Run migrations
alembic upgrade head
```

#### Step 5: Start Backend Server

```bash
# Make sure you're in backend directory with venv activated
# Don't cd into app directory!
python run.py

# Or using uvicorn directly from backend directory:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --reload-dir app
```

Backend will be available at:
- API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 3. Frontend Setup

Open a **new terminal** window:

#### Step 1: Navigate to Frontend Directory

```bash
cd frontend
```

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Configure Environment Variables

```bash
# Copy example environment file
copy .env.example .env

# Edit .env if needed (default should work)
```

**.env Configuration:**
```env
VITE_API_URL=http://localhost:8000
```

#### Step 4: Start Development Server

```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## � Docker Commands (Recommended)

### Quick Start with Docker

1. **Clone and setup:**
   ```bash
   git clone https://github.com/wbin04/SQLTuner.git
   cd SQLTuner
   cp .env.example .env
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build -d
   ```

3. **Check status:**
   ```bash
   curl http://localhost:8000/health
   ```

### Basic Operations
```bash
# Start all services (build if needed)
docker-compose up --build -d

# View logs
docker-compose logs -f backend
docker-compose logs -f sqltuner-server

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️  deletes database data)
docker-compose down -v
```

### Service Management
```bash
# Restart backend only
docker-compose restart backend

# Restart database only
docker-compose restart sqltuner-server

# Restart all services
docker-compose restart
```

### Development
```bash
# Run in foreground (see logs)
docker-compose up

# Rebuild after code changes
docker-compose up --build

# Execute into backend container
docker-compose exec backend bash

# Execute into database container
docker-compose exec sqltuner-server psql -U postgres -d sqltuner_db
```

### Troubleshooting
```bash
# Check service status
docker-compose ps

# View all logs
docker-compose logs

# Clean up (remove containers, networks, images)
docker system prune -a --volumes
```

## �📁 Project Structure

```
SQLTuner/
├── backend/
│   ├── alembic/                 # Database migrations
│   │   ├── versions/            # Migration files
│   │   ├── env.py              # Alembic environment
│   │   └── script.py.mako      # Migration template
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── sql.py           # SQL optimization endpoints
│   │   │       │   └── db_inspector.py  # Database inspection endpoints
│   │   │       └── api.py               # API router
│   │   ├── core/
│   │   │   ├── config.py       # Configuration settings
│   │   │   ├── security.py     # Security utilities
│   │   │   └── constants.py    # Application constants
│   │   ├── db/
│   │   │   ├── base.py         # SQLAlchemy Base
│   │   │   └── session.py      # Async database session
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   │   └── sql.py          # Request/Response schemas
│   │   ├── services/
│   │   │   ├── llm_service.py       # LLM integration
│   │   │   └── inspector_service.py # Database inspection
│   │   └── main.py             # FastAPI application
│   ├── .env.example            # Environment variables template
│   ├── alembic.ini             # Alembic configuration
│   └── requirements.txt        # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── axios.ts        # Axios configuration
│   │   ├── types/
│   │   │   └── api.ts          # TypeScript types
│   │   ├── App.tsx             # Main component
│   │   ├── main.tsx            # Application entry point
│   │   ├── index.css           # Global styles
│   │   └── vite-env.d.ts       # Vite type definitions
│   ├── index.html              # HTML template
│   ├── package.json            # Node dependencies
│   ├── tsconfig.json           # TypeScript configuration
│   ├── vite.config.ts          # Vite configuration
│   ├── tailwind.config.js      # TailwindCSS configuration
│   └── postcss.config.js       # PostCSS configuration
│
├── docs_en/                    # English documentation
├── docs_vi/                    # Vietnamese documentation
└── README.md                   # This file
```

## 🔧 Available API Endpoints

### Health Check
- `GET /health` - Check system status and model availability

### SQL Optimization
- `POST /api/v1/sql/optimize` - Optimize SQL query
  ```json
  {
    "sql_query": "SELECT * FROM users WHERE id = 1",
    "include_schema": false
  }
  ```

- `POST /api/v1/sql/explain` - Get SQL query explanation
  ```json
  {
    "sql_query": "SELECT * FROM users WHERE id = 1"
  }
  ```

### Database Inspection
- `GET /api/v1/database/schema` - Get complete database schema
- `GET /api/v1/database/tables/{table_name}` - Get table information
- `GET /api/v1/database/tables/{table_name}/sample?limit=5` - Get sample rows

## 🧪 Testing

### Backend Testing

```bash
cd backend
# Activate venv first
venv\Scripts\activate

# Test health endpoint
python -c "import httpx; import asyncio; print(asyncio.run(httpx.AsyncClient().get('http://localhost:8000/health')).json())"
```

### Frontend Testing

Open `http://localhost:5173` in your browser. You should see:
- Backend Status: Online (green)
- Model: sqlcoder-thesis
- Model Available: YES (green)

## 🐛 Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError`
```bash
# Ensure virtual environment is activated
venv\Scripts\activate
# Reinstall dependencies
pip install -r requirements.txt
```

**Problem:** Database connection error
```bash
# Verify PostgreSQL is running
# Check .env database credentials
# Create database if not exists
```

**Problem:** Alembic migration errors
```bash
# Reset migrations (development only)
alembic downgrade base
alembic upgrade head
```

### Frontend Issues

**Problem:** Port 5173 already in use
```bash
# Kill process or change port in vite.config.ts
```

**Problem:** API connection error
```bash
# Ensure backend is running on port 8000
# Check VITE_API_URL in .env
```

### Ollama/LLM Issues

**Problem:** Model not available
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Pull model again
ollama pull sqlcoder-thesis
```

## 📝 Development Guidelines

### Backend Development

1. **Adding a new endpoint:**
   - Create router in `app/api/v1/endpoints/`
   - Define schemas in `app/schemas/`
   - Add business logic in `app/services/`
   - Include router in `app/api/v1/api.py`

2. **Adding a database model:**
   - Create model in `app/models/`
   - Import in `alembic/env.py`
   - Run: `alembic revision --autogenerate -m "description"`
   - Run: `alembic upgrade head`

### Frontend Development

1. **Adding a new component:**
   - Create in `src/components/`
   - Use TypeScript for type safety
   - Follow Tailwind utility classes

2. **API integration:**
   - Define types in `src/types/api.ts`
   - Use axios instance from `src/lib/axios.ts`

## 🚢 Production Deployment

### Backend

```bash
# Use production ASGI server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# Or with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend

```bash
npm run build
# Serve dist/ folder with nginx or similar
```

## 📄 License

This project is for educational purposes.

## 👥 Contributors

- Your Team

## 🙏 Acknowledgments

- FastAPI for the excellent web framework
- Ollama for local LLM support
- SQLCoder for SQL-specialized model
- React and Vite teams

---

**Happy Coding! 🚀**

For more information, visit the documentation in `docs_en/` or `docs_vi/`.
