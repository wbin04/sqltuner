"""
Pydantic schemas for database connections and related entities
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from backend.app.models.models import UserRole, DBType, ChatRole


# User Schemas
class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: Optional[UserRole] = UserRole.USER


class UserResponse(UserBase):
    id: UUID
    role: UserRole
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# DBConnection Schemas
class DBConnectionBase(BaseModel):
    name: str = Field(..., max_length=100)
    db_type: DBType = DBType.POSTGRES


class DBConnectionCreate(DBConnectionBase):
    # For real databases
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(5432, ge=1, le=65535)
    username: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = None  # Plain password, will be encrypted
    db_name: Optional[str] = Field(None, max_length=100)


class DBConnectionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = None
    db_name: Optional[str] = Field(None, max_length=100)
    db_type: Optional[DBType] = None


class DBConnectionResponse(DBConnectionBase):
    id: UUID
    user_id: UUID
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    db_name: Optional[str] = None
    meta_schema: Optional[Dict[str, Any]] = None
    metadata_cache: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DBConnectionWithSchema(DBConnectionResponse):
    """Response that includes the cached schema metadata"""
    schema: Optional[Dict[str, Any]] = Field(None, alias="meta_schema")


# Schema Sync
class SchemaSyncRequest(BaseModel):
    """Request to sync schema metadata from target database"""
    force: bool = Field(default=False, description="Force re-sync even if cache exists")


class SchemaSyncResponse(BaseModel):
    """Response after schema sync"""
    success: bool
    message: str
    tables_count: Optional[int] = None
    schema: Optional[Dict[str, Any]] = None


# Conversation Schemas
class ConversationBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ConversationCreate(ConversationBase):
    connection_id: Optional[UUID] = None


class ConversationResponse(ConversationBase):
    id: UUID
    connection_id: Optional[UUID]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# QueryLog Schemas
class QueryLogBase(BaseModel):
    role: ChatRole
    content: str
    sql_generated: Optional[str] = None


class QueryLogCreate(QueryLogBase):
    conversation_id: UUID


class QueryLogResponse(QueryLogBase):
    id: UUID
    conversation_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Feedback Schemas
class FeedbackBase(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    corrected_sql: Optional[str] = None
    comment: Optional[str] = None


class FeedbackCreate(FeedbackBase):
    query_log_id: UUID


class FeedbackResponse(FeedbackBase):
    id: UUID
    query_log_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Performance Analysis Schemas
class PerformanceAnalysisBase(BaseModel):
    execution_time_ms: Optional[float] = None
    total_cost: Optional[float] = None
    explain_plan: Dict[str, Any]
    index_recommendation: Optional[str] = None


class PerformanceAnalysisCreate(PerformanceAnalysisBase):
    query_log_id: UUID


class PerformanceAnalysisResponse(PerformanceAnalysisBase):
    id: UUID
    query_log_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
