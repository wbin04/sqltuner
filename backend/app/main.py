from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.api.v1.api import api_router
from backend.app.schemas.sql import HealthResponse
from backend.app.services.llm_service import llm_service

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="SQLTuner - AI-powered SQL optimization using Local LLM",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    
    Returns:
        - status: API status
        - project_name: Project name
        - llm_model: LLM model name in use
        - model_available: Whether the model is available in Ollama
    """
    model_available = await llm_service.check_health()
    
    return HealthResponse(
        status="online",
        project_name=settings.PROJECT_NAME,
        llm_model=settings.MODEL_NAME,
        model_available=model_available
    )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs_url": "/docs",
        "health_url": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
