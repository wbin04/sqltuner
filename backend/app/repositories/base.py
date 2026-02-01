"""
Base Repository with Generic CRUD Operations
Implements the Repository Pattern for database access abstraction
"""
from typing import TypeVar, Generic, Type, List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.app.db.base import Base

# Type variables for generic repository
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base repository class with common CRUD operations
    
    Type Parameters:
        ModelType: SQLAlchemy model class
        CreateSchemaType: Pydantic schema for creation
        UpdateSchemaType: Pydantic schema for updates
    """
    
    def __init__(self, model: Type[ModelType]):
        """
        Initialize repository with model class
        
        Args:
            model: SQLAlchemy model class
        """
        self.model = model
    
    async def get(
        self, 
        db: AsyncSession, 
        id: UUID
    ) -> Optional[ModelType]:
        """
        Get a single record by ID
        
        Args:
            db: Async database session
            id: Record ID (UUID)
            
        Returns:
            Model instance or None if not found
        """
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_field(
        self,
        db: AsyncSession,
        **filters: Any
    ) -> Optional[ModelType]:
        """
        Get a single record by arbitrary field(s)
        
        Args:
            db: Async database session
            **filters: Field name and value pairs
            
        Returns:
            Model instance or None if not found
        """
        query = select(self.model)
        for field, value in filters.items():
            query = query.where(getattr(self.model, field) == value)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        **filters: Any
    ) -> List[ModelType]:
        """
        Get multiple records with optional filtering and pagination
        
        Args:
            db: Async database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            **filters: Field name and value pairs for filtering
            
        Returns:
            List of model instances
        """
        query = select(self.model)
        
        # Apply filters
        for field, value in filters.items():
            if hasattr(self.model, field):
                query = query.where(getattr(self.model, field) == value)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType | Dict[str, Any]
    ) -> ModelType:
        """
        Create a new record
        
        Args:
            db: Async database session
            obj_in: Pydantic schema or dict with creation data
            
        Returns:
            Created model instance
        """
        # Convert Pydantic model to dict if needed
        if isinstance(obj_in, dict):
            obj_data = obj_in
        else:
            obj_data = obj_in.model_dump(exclude_unset=True)
        
        # Create model instance
        db_obj = self.model(**obj_data)
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | Dict[str, Any]
    ) -> ModelType:
        """
        Update an existing record
        
        Args:
            db: Async database session
            db_obj: Existing model instance to update
            obj_in: Pydantic schema or dict with update data
            
        Returns:
            Updated model instance
        """
        # Convert Pydantic model to dict if needed
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        # Update fields
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        await db.commit()
        await db.refresh(db_obj)
        
        return db_obj
    
    async def delete(
        self,
        db: AsyncSession,
        *,
        id: UUID
    ) -> bool:
        """
        Delete a record by ID
        
        Args:
            db: Async database session
            id: Record ID (UUID)
            
        Returns:
            True if deleted, False if not found
        """
        db_obj = await self.get(db, id=id)
        
        if not db_obj:
            return False
        
        await db.delete(db_obj)
        await db.commit()
        
        return True
    
    async def exists(
        self,
        db: AsyncSession,
        id: UUID
    ) -> bool:
        """
        Check if a record exists by ID
        
        Args:
            db: Async database session
            id: Record ID (UUID)
            
        Returns:
            True if exists, False otherwise
        """
        result = await db.execute(
            select(self.model.id).where(self.model.id == id)
        )
        return result.scalar_one_or_none() is not None
