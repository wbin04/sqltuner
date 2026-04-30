from app.api.v1.endpoints import (admin, auth, chat, connections,
                                  db_inspector, evaluation, history,
                                  schema_generator, simulation, sql, tasks)
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"]
)

api_router.include_router(
    evaluation.router,
    prefix="/evaluation",
    tags=["evaluation"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)

api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["chat"]
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

api_router.include_router(
    history.router,
    prefix="/history",
    tags=["history"]
)

api_router.include_router(
    simulation.router,
    prefix="/simulation",
    tags=["simulation"]
)

api_router.include_router(
    schema_generator.router,
    prefix="/schema-generator",
    tags=["schema-generator"]
)

api_router.include_router(
    tasks.router,
    prefix="",
    tags=["tasks"]
)
