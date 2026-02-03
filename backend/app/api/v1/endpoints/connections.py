from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.security import encrypt_password
from app.db.session import get_db
from app.models.models import DBType, User
from app.repositories.connection_repository import \
    connection_repository
from app.schemas.connection import (DBConnectionCreate,
                                            DBConnectionResponse,
                                            DBConnectionUpdate,
                                            DBConnectionWithSchema,
                                            SchemaSyncRequest,
                                            SchemaSyncResponse)
from app.schemas.schema_def import SchemaDef
from app.services.inspector_service import inspector_service
from app.services.simulation_service import simulation_service

router = APIRouter()


@router.post("/", response_model=DBConnectionResponse,
             status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection_data: DBConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id

    if connection_data.db_type in [DBType.POSTGRES, DBType.MYSQL]:
        if not all([connection_data.host, connection_data.password,
                   connection_data.db_name]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Real database connections require"
                "host, password, and db_name")
        db_password = encrypt_password(connection_data.password)
    else:
        db_password = None

    connection_dict = {
        "user_id": user_id,
        "name": connection_data.name,
        "host": connection_data.host,
        "port": connection_data.port,
        "username": connection_data.username,
        "db_password": db_password,
        "db_name": connection_data.db_name,
        "db_type": connection_data.db_type,
        "meta_schema": {}
    }

    db_connection = await (
        connection_repository.create(db, obj_in=connection_dict)
    )

    return db_connection


@router.get("/", response_model=List[DBConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    connections = await connection_repository.get_by_user(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    return connections


@router.get("/{connection_id}", response_model=DBConnectionWithSchema)
async def get_connection(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    return connection


@router.put("/{connection_id}", response_model=DBConnectionResponse)
async def update_connection(
    connection_id: UUID,
    connection_data: DBConnectionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    update_data = connection_data.model_dump(exclude_unset=True)

    if "password" in update_data:
        update_data["db_password"] = encrypt_password(
            update_data.pop("password"))

    updated_connection = await connection_repository.update(
        db=db,
        db_obj=connection,
        obj_in=update_data
    )

    return updated_connection


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    deleted = await connection_repository.delete_by_user(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )


@router.post("/{connection_id}/sync", response_model=SchemaSyncResponse)
async def sync_connection_schema(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    sync_request: SchemaSyncRequest = SchemaSyncRequest(),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    if connection.db_type == DBType.SIMULATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sync schema from a simulation connection."
            "Use PUT /schema instead.")

    try:
        schema_def = await inspector_service.sync_schema(db, connection_id)

        return SchemaSyncResponse(
            success=True,
            message="Schema synchronized successfully",
            tables_count=len(schema_def.tables),
            schema=schema_def.to_json_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to sync schema: {str(e)}"
        )


@router.get("/{connection_id}/schema", response_model=dict)
async def get_connection_schema(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    if not connection.meta_schema or connection.meta_schema == {}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not available."
            "Please sync the connection or update schema for simulations.")

    return connection.meta_schema


@router.put("/{connection_id}/schema", response_model=dict)
async def update_connection_schema(
    connection_id: UUID,
    schema_data: SchemaDef,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    if connection.db_type != DBType.SIMULATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update schema for simulation connections."
            "Use POST /sync for real databases.")

    try:
        updated_schema = await simulation_service.update_table_metadata(
            db, connection_id, schema_data
        )

        return updated_schema.to_json_dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update schema: {str(e)}"
        )


@router.get("/{connection_id}/ddl", response_class=PlainTextResponse)
async def get_connection_ddl(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )

    try:
        ddl_script = await (
            simulation_service.generate_ddl_for_connection(db, connection_id)
        )
        return ddl_script
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate DDL: {str(e)}"
        )
