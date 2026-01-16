from pydantic import BaseModel, Field


class SQLOptimizeRequest(BaseModel):
    """Request schema for SQL optimization"""
    sql_query: str = Field(..., description="SQL query to optimize", max_length=10000)
    include_schema: bool = Field(default=False, description="Include database schema in optimization")


class SQLOptimizeResponse(BaseModel):
    """Response schema for SQL optimization"""
    original_query: str
    optimized_query: str
    explanation: str | None = None


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
    model_name: str
    model_available: bool


class DatabaseSchemaResponse(BaseModel):
    """Response schema for database schema"""
    raw_schema: dict
    formatted_schema: str
