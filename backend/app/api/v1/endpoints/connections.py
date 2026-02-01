"""
API endpoints for database connections management
Supports both real database connections and virtual simulations
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from backend.app.db.session import get_db
from backend.app.models.models import DBConnection, DBType, User
from backend.app.schemas.connection import (
    DBConnectionCreate,
    DBConnectionUpdate,
    DBConnectionResponse,
    DBConnectionWithSchema,
    SchemaSyncRequest,
    SchemaSyncResponse,
)
from backend.app.schemas.schema_def import SchemaDef
from backend.app.core.security import encrypt_password
from backend.app.services.schema_service import SchemaService
from backend.app.services.inspector_service import inspector_service
from backend.app.services.simulation_service import simulation_service
from backend.app.api.v1.endpoints.auth import get_current_user
from backend.app.repositories.connection_repository import connection_repository

router = APIRouter()


@router.post("/", response_model=DBConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection_data: DBConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new database connection (real or simulation)
    
    - For real databases (postgres/mysql): Provide host, port, username, password, db_name
    - For simulations: Only provide name and db_type='simulation'
    """
    user_id = current_user.id
    
    # Validate: Real DB must have credentials, Simulation must not
    if connection_data.db_type in [DBType.POSTGRES, DBType.MYSQL]:
        if not all([connection_data.host, connection_data.password, connection_data.db_name]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Real database connections require host, password, and db_name"
            )
        # Encrypt password for real DB
        db_password = encrypt_password(connection_data.password)
    else:
        # Simulation - no credentials needed
        db_password = None
    
    # Create connection object using repository
    connection_dict = {
        "user_id": user_id,
        "name": connection_data.name,
        "host": connection_data.host,
        "port": connection_data.port,
        "username": connection_data.username,
        "db_password": db_password,
        "db_name": connection_data.db_name,
        "db_type": connection_data.db_type,
        "meta_schema": {}  # Initialize empty schema
    }
    
    db_connection = await connection_repository.create(db, obj_in=connection_dict)
    
    return db_connection


@router.get("/", response_model=List[DBConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    Get list of database connections for current user
    """
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
    """
    Get a specific database connection with cached schema
    """
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
    """
    Update a database connection
    """
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
    
    # Update fields if provided
    update_data = connection_data.model_dump(exclude_unset=True)
    
    # Handle password encryption if password is being updated
    if "password" in update_data:
        update_data["db_password"] = encrypt_password(update_data.pop("password"))
    
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
    """
    Delete a database connection
    """
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
    """
    Synchronize database schema metadata from a REAL database connection
    
    This endpoint:
    1. Connects to the target database using stored credentials
    2. Extracts metadata (tables, columns, types, foreign keys)
    3. Saves it as JSON in meta_schema field
    4. Returns the schema metadata
    
    Only works for real database connections (not simulations).
    The process is read-only and does not fetch table data.
    """
    # Check if connection exists using repository
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
            detail="Cannot sync schema from a simulation connection. Use PUT /schema instead."
        )
    
    try:
        # Use inspector service to sync schema
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
    """
    Get cached schema metadata for a connection
    Returns 404 if schema is not cached yet
    """
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
            detail="Schema not available. Please sync the connection or update schema for simulations."
        )
    
    return connection.meta_schema


@router.put("/{connection_id}/schema", response_model=dict)
async def update_connection_schema(
    connection_id: UUID,
    schema_data: SchemaDef,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update schema metadata for a SIMULATION connection
    
    This endpoint allows you to define or update the virtual schema
    for simulation connections. Only works for connections with db_type='simulation'.
    
    Request body should contain a complete SchemaDef structure.
    """
    # Check if connection exists using repository
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
            detail="Can only update schema for simulation connections. Use POST /sync for real databases."
        )
    
    try:
        # Use simulation service to update schema
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
    """
    Generate SQL DDL script from connection schema
    
    This endpoint generates a CREATE TABLE script from the meta_schema JSON.
    Useful for:
    - AI context: Providing schema structure to LLM for query generation
    - Documentation: Understanding the virtual database structure
    - Migration: Exporting simulation schema to real database
    
    Returns plain text SQL script.
    """
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
        ddl_script = await simulation_service.generate_ddl_for_connection(db, connection_id)
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
