"""
API endpoints for database connections management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from backend.app.db.session import get_db
from backend.app.models.models import DBConnection
from backend.app.schemas.connection import (
    DBConnectionCreate,
    DBConnectionUpdate,
    DBConnectionResponse,
    DBConnectionWithSchema,
    SchemaSyncRequest,
    SchemaSyncResponse,
)
from backend.app.core.security import encrypt_password
from backend.app.services.schema_service import SchemaService

router = APIRouter()


@router.post("/", response_model=DBConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection_data: DBConnectionCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new database connection
    Password will be encrypted before storing
    """
    # TODO: Get user_id from authentication
    # For now, using a dummy user_id (should be replaced with real auth)
    user_id = "00000000-0000-0000-0000-000000000001"  # Placeholder
    
    # Encrypt password
    encrypted_password = encrypt_password(connection_data.password)
    
    # Create connection object
    db_connection = DBConnection(
        user_id=user_id,
        name=connection_data.name,
        host=connection_data.host,
        port=connection_data.port,
        username=connection_data.username,
        encrypted_password=encrypted_password,
        db_name=connection_data.db_name,
        db_type=connection_data.db_type,
    )
    
    db.add(db_connection)
    await db.commit()
    await db.refresh(db_connection)
    
    return db_connection


@router.get("/", response_model=List[DBConnectionResponse])
async def list_connections(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    Get list of database connections for current user
    """
    # TODO: Filter by authenticated user_id
    result = await db.execute(
        select(DBConnection).offset(skip).limit(limit)
    )
    connections = result.scalars().all()
    return connections


@router.get("/{connection_id}", response_model=DBConnectionWithSchema)
async def get_connection(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific database connection with cached schema
    """
    result = await db.execute(
        select(DBConnection).where(DBConnection.id == connection_id)
    )
    connection = result.scalar_one_or_none()
    
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
    db: AsyncSession = Depends(get_db)
):
    """
    Update a database connection
    """
    result = await db.execute(
        select(DBConnection).where(DBConnection.id == connection_id)
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )
    
    # Update fields if provided
    update_data = connection_data.model_dump(exclude_unset=True)
    
    # Handle password encryption if password is being updated
    if "password" in update_data:
        update_data["encrypted_password"] = encrypt_password(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(connection, field, value)
    
    await db.commit()
    await db.refresh(connection)
    
    return connection


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a database connection
    """
    result = await db.execute(
        select(DBConnection).where(DBConnection.id == connection_id)
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )
    
    await db.delete(connection)
    await db.commit()


@router.post("/{connection_id}/sync", response_model=SchemaSyncResponse)
async def sync_connection_schema(
    connection_id: UUID,
    sync_request: SchemaSyncRequest = SchemaSyncRequest(),
    db: AsyncSession = Depends(get_db)
):
    """
    Synchronize database schema metadata from target database
    
    This endpoint:
    1. Connects to the target database using stored credentials
    2. Extracts metadata (tables, columns, types, foreign keys)
    3. Saves it as JSON cache in the internal database
    4. Returns the schema metadata
    
    The process is read-only and does not fetch table data.
    """
    # Check if connection exists
    result = await db.execute(
        select(DBConnection).where(DBConnection.id == connection_id)
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found"
        )
    
    # Sync schema using service
    sync_result = await SchemaService.sync_connection_schema(
        connection_id=connection_id,
        db=db,
        force=sync_request.force
    )
    
    if not sync_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=sync_result["message"]
        )
    
    return SchemaSyncResponse(**sync_result)


@router.get("/{connection_id}/schema", response_model=dict)
async def get_connection_schema(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get cached schema metadata for a connection
    Returns 404 if schema is not cached yet
    """
    schema = await SchemaService.get_cached_schema(
        connection_id=connection_id,
        db=db
    )
    
    if schema is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not cached. Please sync the connection first."
        )
    
    return schema
