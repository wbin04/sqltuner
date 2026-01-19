from fastapi import APIRouter
from backend.app.api.v1.endpoints import sql, db_inspector, connections, auth

api_router = APIRouter()

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)

api_router.include_router(
    sql.router,
    prefix="/sql",
    tags=["sql"]
)

api_router.include_router(
    db_inspector.router,
    prefix="/database",
    tags=["database"]
)

api_router.include_router(
    connections.router,
    prefix="/connections",
    tags=["connections"]
)
