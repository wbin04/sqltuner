"""
Chat API Endpoints
Implements conversational AI for database queries with schema context
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID, uuid4
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.models.models import DBConnection, Conversation, QueryLog, ChatRole, DBType, User
from backend.app.schemas.sql import ChatCompletionRequest, ChatCompletionResponse
from backend.app.services.llm_service import llm_service
from backend.app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def format_schema_for_prompt(meta_schema: dict) -> str:
    """
    Format meta_schema into a concise text representation for LLM context
    
    Args:
        meta_schema: Schema definition from db_connections.meta_schema
        
    Returns:
        Formatted schema string for system prompt
    """
    if not meta_schema or "tables" not in meta_schema:
        return "No schema information available."
    
    schema_lines = ["Database Schema:"]
    tables = meta_schema.get("tables", [])
    
    for table in tables:
        table_name = table.get("name", "unknown")
        columns = table.get("columns", [])
        
        # Table header
        schema_lines.append(f"\nTable: {table_name}")
        
        # Columns
        for col in columns:
            col_name = col.get("name", "unknown")
            col_type = col.get("data_type", "unknown")
            nullable = "NULL" if col.get("nullable", True) else "NOT NULL"
            pk = " PRIMARY KEY" if col.get("primary_key", False) else ""
            
            schema_lines.append(f"  - {col_name}: {col_type} {nullable}{pk}")
        
        # Foreign keys
        foreign_keys = table.get("foreign_keys", [])
        if foreign_keys:
            schema_lines.append("  Foreign Keys:")
            for fk in foreign_keys:
                fk_col = fk.get("column", "")
                ref_table = fk.get("referenced_table", "")
                ref_col = fk.get("referenced_column", "")
                schema_lines.append(f"    - {fk_col} -> {ref_table}.{ref_col}")
    
    return "\n".join(schema_lines)


@router.post("/completion", response_model=ChatCompletionResponse)
async def chat_completion(
    request: ChatCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate AI chat completion with database schema context
    
    Flow:
    1. Fetch connection and meta_schema
    2. Create or fetch conversation
    3. Build system prompt with schema context
    4. Call LLM service
    5. Save user message and AI response to query_logs
    6. Return AI response
    """
    # 1. Fetch connection and validate ownership
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == request.connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or access denied"
        )
    
    # 2. Get or create conversation
    conversation_id = request.conversation_id
    
    if conversation_id:
        # Fetch existing conversation
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.connection_id == request.connection_id
            )
        )
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        # Create new conversation
        conversation = Conversation(
            id=uuid4(),
            connection_id=request.connection_id,
            title=request.message[:50] + ("..." if len(request.message) > 50 else ""),
            created_at=datetime.utcnow()
        )
        db.add(conversation)
        await db.flush()
        conversation_id = conversation.id
    
    # 3. Build system prompt with schema context
    schema_text = format_schema_for_prompt(connection.meta_schema or {})
    
    db_type_name = connection.db_type.value if connection.db_type else "PostgreSQL"
    
    system_prompt = f"""You are an expert SQL assistant for {db_type_name} databases.

{schema_text}

Instructions:
- Answer user questions about the database
- Generate SQL queries when requested
- Explain query results clearly
- If generating SQL, wrap it in ```sql code blocks
- Be concise and helpful"""
    
    # 4. Call LLM service
    try:
        llm_response = await llm_service._call_ollama(
            model=llm_service.chat_model,  # Use chat model for conversations
            prompt=request.message,
            system_prompt=system_prompt,
            temperature=0.3
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM service error: {str(e)}"
        )
    
    # 5. Extract SQL from response if present (between ```sql and ```)
    sql_generated = None
    if "```sql" in llm_response:
        try:
            sql_start = llm_response.index("```sql") + 6
            sql_end = llm_response.index("```", sql_start)
            sql_generated = llm_response[sql_start:sql_end].strip()
        except (ValueError, IndexError):
            pass  # No valid SQL block found
    
    # 6. Save user message to query_logs
    user_log = QueryLog(
        id=uuid4(),
        conversation_id=conversation_id,
        role=ChatRole.USER,
        content=request.message,
        created_at=datetime.utcnow()
    )
    db.add(user_log)
    
    # 7. Save AI response to query_logs
    assistant_log = QueryLog(
        id=uuid4(),
        conversation_id=conversation_id,
        role=ChatRole.ASSISTANT,
        content=llm_response,
        sql_generated=sql_generated,
        created_at=datetime.utcnow()
    )
    db.add(assistant_log)
    
    await db.commit()
    
    # 8. Return response
    return ChatCompletionResponse(
        conversation_id=conversation_id,
        role="assistant",
        content=llm_response,
        sql_generated=sql_generated
    )


@router.get("/conversations/{connection_id}")
async def get_conversations(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all conversations for a connection
    """
    # Validate connection ownership
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Fetch conversations
    result = await db.execute(
        select(Conversation)
        .where(Conversation.connection_id == connection_id)
        .order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().all()
    
    return [
        {
            "id": str(conv.id),
            "title": conv.title,
            "created_at": conv.created_at.isoformat(),
        }
        for conv in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all messages in a conversation
    """
    # Fetch conversation and validate access
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Validate connection ownership
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == conversation.connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Fetch messages
    result = await db.execute(
        select(QueryLog)
        .where(QueryLog.conversation_id == conversation_id)
        .order_by(QueryLog.created_at.asc())
    )
    messages = result.scalars().all()
    
    return [
        {
            "id": str(msg.id),
            "role": msg.role.value,
            "content": msg.content,
            "sql_generated": msg.sql_generated,
            "created_at": msg.created_at.isoformat(),
        }
        for msg in messages
    ]
