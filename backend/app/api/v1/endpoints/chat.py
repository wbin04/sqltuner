import json
import logging
import time
from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.api.v1.endpoints.auth import get_current_user
from backend.app.core.prompts import (CHAT_GENERAL_SYSTEM_PROMPT,
                                      get_chat_sql_system_prompt)
from backend.app.db.session import get_db
from backend.app.models.models import (ChatRole, Conversation, DBConnection,
                                       QueryLog, User)
from backend.app.schemas.sql import (ChatCompletionRequest,
                                     ChatCompletionResponse)
from backend.app.services.llm_service import llm_service

router = APIRouter()

logger = logging.getLogger(__name__)


@lru_cache(maxsize=128)
def _cached_format_schema(
    schema_json: str,
    limit_tables: int,
    mentioned_table_names: tuple
) -> str:
    meta_schema = json.loads(schema_json)
    all_tables = meta_schema.get("tables", [])

    mentioned_tables = None
    if mentioned_table_names:
        mentioned_tables = [t for t in all_tables
                            if t.get("name") in mentioned_table_names]

    return format_schema_for_prompt(meta_schema,
                                    limit_tables,
                                    mentioned_tables)


def extract_mentioned_tables(message: str, all_tables: list) -> list:
    message_lower = message.lower()
    mentioned = []

    for table in all_tables:
        table_name = table.get("name", "").lower()
        if table_name in message_lower:
            mentioned.append(table)

    return mentioned


def format_schema_for_prompt(
    meta_schema: dict,
    limit_tables: int = 10,
    mentioned_tables: list = None
) -> str:
    if not meta_schema or "tables" not in meta_schema:
        return "No schema information available."

    schema_lines = ["Database Schema:"]
    all_tables = meta_schema.get("tables", [])

    if mentioned_tables:
        tables = mentioned_tables[:limit_tables]
        if len(mentioned_tables) > limit_tables:
            schema_lines.append(
                f"(Showing {limit_tables} of {len(mentioned_tables)}"
                "relevant tables)")
    else:
        tables = all_tables[:limit_tables]
        if len(all_tables) > limit_tables:
            schema_lines.append(
                f"(Showing {limit_tables} of {len(all_tables)} tables)")

    for table in tables:
        table_name = table.get("name", "unknown")
        columns = table.get("columns", [])

        schema_lines.append(f"\nTable: {table_name}")

        for col in columns:
            col_name = col.get("name", "unknown")
            col_type = col.get("type", col.get("data_type", "unknown"))
            nullable = "NULL" if col.get("is_nullable", True) else "NOT NULL"
            pk = " PRIMARY KEY" if col.get("is_pk", False) else ""

            schema_lines.append(f"  - {col_name}: {col_type} {nullable}{pk}")

        foreign_keys = table.get("foreign_keys", [])
        if foreign_keys:
            schema_lines.append("  Foreign Keys:")
            for fk in foreign_keys:
                fk_col = fk.get("column", "")
                ref_table = fk.get("ref_table", fk.get("referenced_table", ""))
                ref_col = fk.get("ref_column", fk.get("referenced_column", ""))
                schema_lines.append(f"    - {fk_col} -> {ref_table}.{ref_col}")

    return "\n".join(schema_lines)


@router.post("/completion", response_model=ChatCompletionResponse)
async def chat_completion(
    request: ChatCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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

    conversation_id = request.conversation_id

    if conversation_id:
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
        conversation = Conversation(
            id=uuid4(),
            connection_id=request.connection_id,
            title=request.message[:50] +
            ("..." if len(request.message) > 50 else ""),
            created_at=datetime.now(timezone.utc)
        )
        db.add(conversation)
        await db.flush()
        conversation_id = conversation.id

    start_time = time.time()

    all_tables = connection.meta_schema.get(
        "tables",
        []
    ) if connection.meta_schema else []
    mentioned_tables = extract_mentioned_tables(request.message, all_tables)

    logger.info("[CHAT] Mentioned tables:"
                f"{[t.get('name') for t in mentioned_tables]}")

    schema_json = json.dumps(connection.meta_schema or {})
    mentioned_names = tuple(
        sorted([t.get('name') for t in mentioned_tables])
    ) if mentioned_tables else ()

    schema_text = _cached_format_schema(schema_json, 10, mentioned_names)
    schema_format_time = time.time() - start_time

    logger.info(f"[CHAT] Schema formatted: {len(schema_text):,} bytes"
                f"in {schema_format_time:.2f}s")

    db_type_name = (
        connection.db_type.value if connection.db_type else "PostgreSQL"
    )

    dialect = connection.db_type.value if connection.db_type else "postgres"

    is_sql_query = llm_service._is_sql_query(request.message)
    extracted_sql = None

    if is_sql_query:
        extracted_sql = llm_service._extract_sql_from_message(request.message)

        sql_system_prompt = get_chat_sql_system_prompt(dialect)
        system_note = (
            f"[SYSTEM NOTE: Ensure all SQL syntax is valid "
            f"for {dialect.upper()}]"
        )
        system_prompt = (
            f"{sql_system_prompt}\n\n"
            f"Database Type: {db_type_name}\n\n"
            f"{schema_text}\n\n"
            f"{system_note}"
        )
        logger.info(f"[CHAT] Using SQL analysis prompt for dialect: {dialect}")
    else:
        system_prompt = (
            f"{CHAT_GENERAL_SYSTEM_PROMPT}\n\n"
            f"Database Type: {db_type_name}\n\n"
            f"{schema_text}\n\n"
            f"Instructions:\n"
            f"- Answer user questions about the database\n"
            f"- Generate SQL queries when requested\n"
            f"- Explain query results clearly\n"
            f"- If generating SQL, wrap it in ```sql code blocks\n"
            f"- Be concise and helpful"
        )
        logger.info("[CHAT] Using general chat system prompt")

    prompt_size = len(system_prompt) + len(request.message)
    print(f"[DEBUG-CHAT] Total prompt size: {prompt_size:,} bytes")
    logger.info(f"[CHAT] Total prompt: {prompt_size:,} bytes")

    try:
        llm_start = time.time()
        llm_response = await llm_service.chat(
            prompt=request.message,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=256
        )
        llm_duration = time.time() - llm_start
        print(f"[DEBUG-CHAT] LLM took: {llm_duration:.2f}s")
        logger.info(f"[CHAT] LLM took: {llm_duration:.2f}s")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM service error: {str(e)}"
        )

    sql_generated = None
    if "```sql" in llm_response:
        try:
            sql_start = llm_response.index("```sql") + 6
            sql_end = llm_response.index("```", sql_start)
            sql_generated = llm_response[sql_start:sql_end].strip()
        except (ValueError, IndexError):
            pass

    detected_sql = extracted_sql

    user_log = QueryLog(
        id=uuid4(),
        conversation_id=conversation_id,
        role=ChatRole.USER,
        content=request.message,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user_log)

    assistant_log = QueryLog(
        id=uuid4(),
        conversation_id=conversation_id,
        role=ChatRole.ASSISTANT,
        content=llm_response,
        sql_generated=sql_generated,
        created_at=datetime.now(timezone.utc)
    )
    db.add(assistant_log)

    await db.commit()

    response_data = {
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": llm_response,
        "sql_generated": sql_generated
    }

    if detected_sql:
        response_data["detected_sql"] = detected_sql
        logger.info(f"[CHAT] Returning detected SQL: {detected_sql[:50]}...")

    return ChatCompletionResponse(**response_data)


@router.get("/conversations/{connection_id}")
async def get_conversations(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

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
