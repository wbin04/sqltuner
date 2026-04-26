from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatCompletionRequest(BaseModel):
    connection_id: UUID = Field(..., description="Database connection ID")
    conversation_id: Optional[UUID] = Field(
        None, description="Conversation ID (optional for new conversations)")
    message: str = Field(..., description="User message", max_length=5000)
    clarification_answers: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Answers from clarification step: [{q: str, answer: str}]"
    )
    chat_mode: Literal["chat", "check", "gen", "fix"] = Field(
        default="chat",
        description=(
            "chat: generate SQL from natural language. "
            "check: validate/fix SQL syntax — bypasses LLM if already valid. "
            "gen: design database schema. "
            "fix: fix execution error using sample data."
        )
    )
    error_message: Optional[str] = Field(
        None,
        description="Error from SQL execution — used in fix mode"
    )
    original_sql: Optional[str] = Field(
        None,
        description="The SQL that failed — used in fix mode"
    )


class ChatCompletionResponse(BaseModel):
    conversation_id: UUID
    role: str
    content: str
    sql_generated: Optional[str] = None
    is_schema_design: Optional[bool] = False
    schema_generated: Optional[Dict[str, Any]] = None
    detected_sql: Optional[str] = Field(
        None,
        description="Extracted SQL from user message for action buttons"
    )


class SQLExecuteRequest(BaseModel):
    connection_id: UUID = Field(..., description="Database connection ID")
    sql: str = Field(..., description="SQL query to execute", max_length=10000)


class SQLExecuteResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    execution_time_ms: float
    row_count: int
    total_rows: int = Field(
        ...,
        description="Total number of rows in result set (before truncation)"
    )
    truncated: bool = Field(
        False,
        description="Whether result set was truncated due to size limit"
    )
    max_rows: int = Field(
        10000,
        description="Maximum number of rows returned"
    )


class SQLExplainPlanRequest(BaseModel):
    connection_id: UUID = Field(..., description="Database connection ID")
    sql: str = Field(..., description="SQL query to explain", max_length=10000)


class SQLExplainPlanResponse(BaseModel):
    db_type: Literal["simulation", "mysql", "postgresql", "postgresql_sandbox"]
    explain_columns: List[str]
    explain_rows: List[Dict[str, Any]]
    analyze_columns: Optional[List[str]] = None
    analyze_rows: Optional[List[Dict[str, Any]]] = None
    analyze_available: bool = False
    analyze_unavailable_reason: Optional[str] = None
    execution_time_ms: Optional[float] = None


class SQLOptimizeRequest(BaseModel):
    connection_id: UUID = Field(..., description="Database connection ID")
    conversation_id: Optional[UUID] = Field(
        None, description="Conversation ID for logging (optional)")
    sql_query: str = Field(...,
                           description="SQL query to optimize",
                           max_length=10000)
    include_explain: bool = Field(
        default=True, description="Include EXPLAIN analysis")


class SQLOptimizeResponse(BaseModel):
    original_sql: str
    optimized_sql: str
    explanation: str
    index_recommendation: Optional[str] = None
    rewrite_type: Optional[str] = None
    changes_made: Optional[List[str]] = None
    bottlenecks: Optional[List[str]] = None
    stats_comparison: Optional[Dict[str, Any]] = None
    query_log_id: Optional[UUID] = None


class SQLExplainRequest(BaseModel):
    sql_query: str = Field(...,
                           description="SQL query to explain",
                           max_length=10000)


class SQLExplainResponse(BaseModel):
    sql_query: str
    explanation: str


class HealthResponse(BaseModel):
    status: str
    project_name: str
    llm_model: str
    model_available: bool

    model_config = ConfigDict(protected_namespaces=())


class DatabaseSchemaResponse(BaseModel):
    raw_schema: dict
    formatted_schema: str