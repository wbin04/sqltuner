import json
import logging
import re
import time
from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID

from app.api.v1.endpoints.auth import get_current_user
from app.core.prompts import (CHAT_GENERAL_SYSTEM_PROMPT,
                              CHAT_SCHEMA_DESIGN_SYSTEM_PROMPT,
                              get_chat_schema_design_prompt,
                              get_chat_sql_system_prompt,
                              get_schema_clarification_prompt)
from app.db.session import get_db
from app.models.models import ChatRole, User
from app.repositories.connection_repository import connection_repository
from app.repositories.conversation_repository import conversation_repository
from app.repositories.query_log_repository import query_log_repository
from app.schemas.sql import ChatCompletionRequest, ChatCompletionResponse
from app.services.llm_service import llm_service
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

logger = logging.getLogger(__name__)

SCHEMA_DESIGN_MIN_WORDS_FOR_DIRECT_GENERATE = 12


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
            continue

    return mentioned


def format_schema_for_prompt(
    meta_schema: dict,
    limit_tables: int = 10,
    mentioned_tables: list = None
) -> str:
    if not meta_schema or "tables" not in meta_schema:
        return "No schema information available."

    all_tables = meta_schema.get("tables", [])

    # Nếu có mentioned tables → format chi tiết, giới hạn 10
    if mentioned_tables:
        tables = mentioned_tables[:limit_tables]
        return _format_tables_detailed(tables)

    # Không có mentioned tables → inject TẤT CẢ tables dạng compact
    # để LLM biết đủ bảng để chọn đúng
    return _format_tables_compact(all_tables)


def _format_tables_detailed(tables: list) -> str:
    """Format đầy đủ với columns và FK — dùng khi biết bảng cụ thể."""
    lines = ["Database Schema (relevant tables):"]
    for table in tables:
        table_name = table.get("name", "unknown")
        columns = table.get("columns", [])
        lines.append(f"\nTable: {table_name}")
        for col in columns:
            col_name = col.get("name", "unknown")
            col_type = col.get("type", col.get("data_type", "unknown"))
            nullable = "NULL" if col.get("is_nullable", True) else "NOT NULL"
            pk = " PRIMARY KEY" if col.get("is_pk", False) else ""
            lines.append(f"  - {col_name}: {col_type} {nullable}{pk}")
        foreign_keys = table.get("foreign_keys", [])
        if foreign_keys:
            lines.append("  Foreign Keys:")
            for fk in foreign_keys:
                fk_col = fk.get("column", "")
                ref_table = fk.get("ref_table", fk.get("referenced_table", ""))
                ref_col = fk.get("ref_column", fk.get("referenced_column", ""))
                lines.append(f"    - {fk_col} -> {ref_table}.{ref_col}")
    return "\n".join(lines)


def _format_tables_compact(tables: list) -> str:
    """Format compact — dùng khi inject tất cả tables để LLM tự tìm bảng phù hợp."""
    lines = ["Database Schema (all tables):"]
    for table in tables:
        table_name = table.get("name", "unknown")
        columns = table.get("columns", [])
        col_names = [c.get("name", "") for c in columns]
        fks = table.get("foreign_keys", [])
        fk_info = ""
        if fks:
            fk_parts = [
                f"{fk.get('column')}→{fk.get('ref_table', fk.get('referenced_table', ''))}.{fk.get('ref_column', fk.get('referenced_column', ''))}"
                for fk in fks
            ]
            fk_info = f" | FK: {', '.join(fk_parts)}"
        lines.append(f"- {table_name}({', '.join(col_names)}){fk_info}")
    return "\n".join(lines)


def _is_schema_design_intent(message: str) -> bool:
    message_lower = message.lower()
    design_keywords = [
        "tạo database", "tạo cơ sở dữ liệu", "thiết kế database",
        "thiết kế cơ sở dữ liệu", "tạo bảng cho", "tạo schema",
        "xây dựng database", "xây dựng cơ sở dữ liệu", "thiết kế bảng",
        "cần database", "cần cơ sở dữ liệu", "muốn tạo database",
        "muốn tạo cơ sở dữ liệu", "hệ thống quản lý", "muốn thiết kế",
        "create a database", "design a database", "design database",
        "create database schema", "design schema for", "database for",
        "schema for", "build a database", "create tables for",
        "data model for", "erd for", "i need a database",
        "i want to create a database", "create a schema", "design a schema",
    ]
    return any(keyword in message_lower for keyword in design_keywords)


def _extract_first_json_object(text: str) -> str:
    """Extract the first complete JSON object and ignore trailing content."""
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found")

    depth = 0
    in_string = False
    is_escaped = False

    for i in range(start, len(text)):
        ch = text[i]

        if in_string:
            if is_escaped:
                is_escaped = False
                continue
            if ch == "\\":
                is_escaped = True
                continue
            if ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]

    raise ValueError("Unclosed JSON object")


async def _check_schema_clarification_inline(message: str) -> dict:
    word_count = len(message.split())
    specific_keywords = [
        "quản lý", "bán hàng", "đặt hàng", "khách hàng", "sản phẩm",
        "nhân viên", "kho hàng", "thanh toán", "thành viên", "đăng ký",
        "nhà cung cấp", "danh mục", "đơn hàng", "hoá đơn", "tồn kho",
        "manage", "store", "order", "customer", "product",
        "employee", "inventory", "payment", "member", "register",
        "library", "hospital", "school", "restaurant", "hotel",
        "supplier", "category", "invoice", "booking", "reservation",
    ]
    has_specific = any(
        kw in message.lower() for kw in specific_keywords
    )

    if (
        word_count >= SCHEMA_DESIGN_MIN_WORDS_FOR_DIRECT_GENERATE
        and has_specific
    ):
        logger.info(
            "[CHAT] Clarification skipped: %d words, specific=%s",
            word_count, has_specific,
        )
        return {"needs_clarification": False, "questions": []}

    try:
        context_prompt = get_schema_clarification_prompt(message)
        raw = await llm_service.chat(
            prompt=context_prompt,
            system_prompt=None,
            temperature=0.1,
            max_tokens=512,
        )
        clean = re.sub(r"```(?:json)?\s*|```", "", raw).strip()
        json_str = _extract_first_json_object(clean)
        result = json.loads(json_str)
        logger.info(
            "[CHAT] Clarification result: needs=%s, q=%d",
            result.get("needs_clarification"),
            len(result.get("questions", [])),
        )
        return result
    except Exception as e:
        logger.warning("[CHAT] Clarification check failed: %s", e)
        return {"needs_clarification": False, "questions": []}


@router.post("/completion", response_model=ChatCompletionResponse)
async def chat_completion(
    request: ChatCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=request.connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or access denied"
        )

    conversation_id = request.conversation_id

    if conversation_id:
        conversation = await conversation_repository.get(
            db, id=conversation_id
        )

        if not conversation or (
            conversation.connection_id != request.connection_id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        conversation = await conversation_repository.create(
            db,
            obj_in={
                "connection_id": request.connection_id,
                "title": request.message[:50] +
                ("..." if len(request.message) > 50 else ""),
                "created_at": datetime.now(timezone.utc)
            }
        )
        conversation_id = conversation.id

    # Save the user message immediately (before LLM) to preserve the true send timestamp
    user_message_received_at = datetime.now(timezone.utc)
    await query_log_repository.create(
        db,
        obj_in={
            "conversation_id": conversation_id,
            "role": ChatRole.USER,
            "content": request.message,
            "created_at": user_message_received_at
        }
    )

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

    is_schema_design = (
        _is_schema_design_intent(request.message)
        or bool(request.clarification_answers)
    )
    is_sql_query = (
        llm_service._is_sql_query(request.message) and not is_schema_design
    )
    extracted_sql = None

    if is_schema_design:
        system_prompt = CHAT_SCHEMA_DESIGN_SYSTEM_PROMPT
        logger.info("[CHAT] Schema design intent detected")
    elif is_sql_query:
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

    schema_prompt = request.message
    if is_schema_design:
        has_answers = bool(request.clarification_answers)

        if not has_answers:
            clarification_check = await _check_schema_clarification_inline(
                request.message
            )
            if (
                clarification_check.get("needs_clarification")
                and clarification_check.get("questions")
            ):
                questions = clarification_check["questions"]
                clarification_content = (
                    "Before designing the schema, I have a few questions:\n\n"
                    + "\n".join(
                        f"{index + 1}. {q.get('q', '')}"
                        + (
                            f"\n   Options: {', '.join(q.get('options', []))}"
                            if q.get("options")
                            else ""
                        )
                        for index, q in enumerate(questions)
                    )
                    + "\n\nPlease answer these questions and I'll generate the schema."
                )

                # User message already saved above — only save the assistant clarification response
                await query_log_repository.create(
                    db,
                    obj_in={
                        "conversation_id": conversation_id,
                        "role": ChatRole.ASSISTANT,
                        "content": clarification_content,
                        "schema_generated": None,
                        "created_at": datetime.now(timezone.utc)
                    }
                )

                return ChatCompletionResponse(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=clarification_content,
                    is_schema_design=False,
                    schema_generated=None,
                )

        schema_prompt = get_chat_schema_design_prompt(
            user_description=request.message,
            clarification_answers=request.clarification_answers,
        )
        logger.info(
            "[CHAT] Schema design - generating with prompt len=%s",
            len(schema_prompt),
        )

    prompt_size = len(system_prompt) + len(schema_prompt)
    logger.info(f"[CHAT] Total prompt: {prompt_size:,} bytes")

    try:
        llm_start = time.time()
        if is_schema_design:
            llm_response = await llm_service.chat_schema_design(
                prompt=schema_prompt,
                system_prompt=system_prompt,
            )
        else:
            llm_response = await llm_service.chat(
                prompt=request.message,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=2048,
            )
        llm_duration = time.time() - llm_start
        logger.info(f"[CHAT] LLM took: {llm_duration:.2f}s")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM service error: {str(e)}"
        )

    sql_generated = None
    schema_generated = None
    llm_response_for_content = llm_response
    if is_schema_design:
        try:
            clean = re.sub(r"```(?:json)?\s*|```", "", llm_response).strip()
            json_str = _extract_first_json_object(clean)
            schema_generated = json.loads(json_str)

            tables = schema_generated.get("tables", [])
            has_columns = all(
                isinstance(table.get("columns"), list)
                and len(table.get("columns", [])) > 0
                for table in tables
            ) if tables else False

            if not has_columns:
                logger.warning("[CHAT] Schema missing columns in some tables")

            logger.info(
                "[CHAT] Schema generated: %s tables, has_columns=%s",
                len(tables),
                has_columns,
            )

            table_names = ", ".join(
                table.get("name", "")
                for table in tables[:6]
                if table.get("name")
            )
            llm_response_for_content = (
                f"I've designed a {schema_generated.get('system_name', 'database')} "
                f"schema with {len(tables)} tables"
                + (f": {table_names}. " if table_names else ". ")
                + "Review the schema below and click Apply to Sandbox to use it."
            )
        except Exception as e:
            logger.warning(f"[CHAT] Failed to parse schema JSON: {e}")
            schema_generated = None
            llm_response_for_content = llm_response
    elif "```sql" in llm_response:
        try:
            sql_start = llm_response.index("```sql") + 6
            sql_end = llm_response.index("```", sql_start)
            sql_generated = llm_response[sql_start:sql_end].strip()
        except (ValueError, IndexError):
            pass

    detected_sql = extracted_sql

    try:
        await db.rollback()
    except Exception:
        pass

    # User message was already saved at request-receive time above.
    # Only save the assistant response now.
    await query_log_repository.create(
        db,
        obj_in={
            "conversation_id": conversation_id,
            "role": ChatRole.ASSISTANT,
            "content": llm_response_for_content,
            "sql_generated": sql_generated,
            "schema_generated": (
                schema_generated if isinstance(schema_generated, dict) else None
            ),
            "created_at": datetime.now(timezone.utc)
        }
    )

    response_data = {
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": llm_response_for_content,
        "sql_generated": sql_generated,
        "is_schema_design": is_schema_design,
        "schema_generated": schema_generated,
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
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

    conversations = await conversation_repository.get_by_connection(
        db=db,
        connection_id=connection_id
    )

    return [
        {
            "id": str(conv.id),
            "title": conv.title,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat() if hasattr(conv, 'updated_at') and conv.updated_at else conv.created_at.isoformat(),
        }
        for conv in conversations
    ]


@router.patch("/conversations/{conversation_id}/rename")
async def rename_conversation(
    conversation_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conversation = await conversation_repository.get(db, id=conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=conversation.connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    new_title = body.get("title", "").strip()
    if not new_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty"
        )

    updated = await conversation_repository.update(
        db,
        db_obj=conversation,
        obj_in={"title": new_title}
    )

    return {
        "id": str(updated.id),
        "title": updated.title,
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conversation = await conversation_repository.get(db, id=conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=conversation.connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    deleted = await conversation_repository.delete(db, id=conversation_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation"
        )

    return {"success": True, "id": str(conversation_id)}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conversation = await conversation_repository.get(db, id=conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=conversation.connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    messages = await query_log_repository.get_by_conversation(
        db=db,
        conversation_id=conversation_id
    )

    return [
        {
            "id": str(msg.id),
            "role": msg.role.value,
            "content": msg.content,
            "sql_generated": msg.sql_generated,
            "schema_generated": msg.schema_generated,
            "is_schema_design": bool(msg.schema_generated),
            "created_at": msg.created_at.isoformat(),
        }
        for msg in messages
    ]

@router.patch("/messages/{message_id}")
async def update_message(
    message_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = await query_log_repository.get(db, id=message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
        
    conversation = await conversation_repository.get(db, id=message.conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
        
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=conversation.connection_id
    )
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated_sql = body.get("sql_generated")
    if updated_sql is not None:
        updated = await query_log_repository.update(
            db,
            db_obj=message,
            obj_in={"sql_generated": updated_sql}
        )
        return {"id": str(updated.id), "sql_generated": updated.sql_generated}
        
    return {"id": str(message.id)}
