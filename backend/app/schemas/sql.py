from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID


# Chat Schemas
class ChatCompletionRequest(BaseModel):
    """Request schema for chat completion"""
    connection_id: UUID = Field(..., description="Database connection ID")
    conversation_id: Optional[UUID] = Field(None, description="Conversation ID (optional for new conversations)")
    message: str = Field(..., description="User message", max_length=5000)


class ChatCompletionResponse(BaseModel):
    """Response schema for chat completion"""
    conversation_id: UUID
    role: str  # "assistant"
    content: str
    sql_generated: Optional[str] = None


# SQL Execution Schemas
class SQLExecuteRequest(BaseModel):
    """Request schema for SQL execution"""
    connection_id: UUID = Field(..., description="Database connection ID")
    sql: str = Field(..., description="SQL query to execute", max_length=10000)


class SQLExecuteResponse(BaseModel):
    """Response schema for SQL execution"""
    columns: List[str]
    rows: List[Dict[str, Any]]
    execution_time_ms: float
    row_count: int


class SQLExplainPlanRequest(BaseModel):
    """Request schema for SQL EXPLAIN"""
    connection_id: UUID = Field(..., description="Database connection ID")
    sql: str = Field(..., description="SQL query to explain", max_length=10000)


class SQLExplainPlanResponse(BaseModel):
    """Response schema for SQL EXPLAIN"""
    plan: Dict[str, Any]
    total_cost: float
    execution_time_ms: Optional[float] = None


class SQLOptimizeRequest(BaseModel):
    """Request schema for SQL optimization"""
    connection_id: UUID = Field(..., description="Database connection ID")
    conversation_id: Optional[UUID] = Field(None, description="Conversation ID for logging (optional)")
    sql_query: str = Field(..., description="SQL query to optimize", max_length=10000)
    include_explain: bool = Field(default=True, description="Include EXPLAIN analysis")


class SQLOptimizeResponse(BaseModel):
    """Response schema for SQL optimization"""
    original_sql: str
    optimized_sql: str
    explanation: str
    index_recommendation: Optional[str] = None
    stats_comparison: Optional[Dict[str, Any]] = None  # {"old_cost": 100, "new_cost": 50}
    query_log_id: Optional[UUID] = None  # For persistent history


class SQLExplainRequest(BaseModel):
    """Request schema for SQL explanation"""
    sql_query: str = Field(..., description="SQL query to explain", max_length=10000)


class SQLExplainResponse(BaseModel):
    """Response schema for SQL explanation"""
    sql_query: str
    explanation: str


class HealthResponse(BaseModel):
    """Response schema for health check"""
    status: str
    project_name: str
    llm_model: str
    model_available: bool
    
    model_config = ConfigDict(protected_namespaces=())


class DatabaseSchemaResponse(BaseModel):
    """Response schema for database schema"""
    raw_schema: dict
    formatted_schema: str
