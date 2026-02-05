import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from backend.app.api.v1.api import api_router
from backend.app.core.config import settings
from backend.app.core.exceptions import (AuthenticationError,
                                         DatabaseConnectionError,
                                         ExecutionError, LLMServiceError,
                                         NotFoundError, PermissionDeniedError,
                                         ValidationError)
from backend.app.schemas.sql import HealthResponse
from backend.app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

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

app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

app.include_router(api_router, prefix=settings.API_V1_STR)


# Exception handlers
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    logger.warning(f"NotFoundError: {exc.message}")
    return JSONResponse(
        status_code=404,
        content={"detail": exc.message}
    )


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    logger.warning(f"ValidationError: {exc.message}")
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message}
    )


@app.exception_handler(AuthenticationError)
async def authentication_error_handler(
    request: Request,
    exc: AuthenticationError
):
    logger.warning(f"AuthenticationError: {exc.message}")
    return JSONResponse(
        status_code=401,
        content={"detail": exc.message}
    )


@app.exception_handler(PermissionDeniedError)
async def permission_denied_handler(
    request: Request,
    exc: PermissionDeniedError
):
    logger.warning(f"PermissionDeniedError: {exc.message}")
    return JSONResponse(
        status_code=403,
        content={"detail": exc.message}
    )


@app.exception_handler(DatabaseConnectionError)
async def database_connection_error_handler(
    request: Request,
    exc: DatabaseConnectionError
):
    logger.error(f"DatabaseConnectionError: {exc.message}")
    return JSONResponse(
        status_code=503,
        content={"detail": exc.message}
    )


@app.exception_handler(LLMServiceError)
async def llm_service_error_handler(
    request: Request,
    exc: LLMServiceError
):
    logger.error(f"LLMServiceError: {exc.message}")
    return JSONResponse(
        status_code=503,
        content={"detail": exc.message}
    )


@app.exception_handler(ExecutionError)
async def execution_error_handler(
    request: Request,
    exc: ExecutionError
):
    logger.error(f"ExecutionError: {exc.message}")
    return JSONResponse(
        status_code=500,
        content={"detail": exc.message}
    )


@app.on_event("startup")
async def startup_event():
    """Run model warm-up on startup to avoid cold start delays"""
    logger.info("Running startup tasks...")
    asyncio.create_task(llm_service.warmup_models())
    logger.info("Startup tasks initiated")


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
