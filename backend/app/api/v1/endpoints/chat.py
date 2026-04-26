"""
chat.py — Chat completion endpoint with 3 distinct modes:
  - chat : generate SQL from natural language (fast, schema-aware)
  - check: validate/fix SQL syntax — skips LLM entirely if syntax is valid
  - gen  : design database schema (uses existing 2-phase generation)
"""

import json
import logging
import re
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Optional
from uuid import UUID

import sqlglot

from app.api.v1.endpoints.auth import get_current_user
from app.core.prompts import (
    CHAT_SCHEMA_DESIGN_SYSTEM_PROMPT,
    get_chat_check_system_prompt,
    get_chat_check_user_prompt,
    get_chat_generate_sql_system_prompt,
    get_chat_schema_design_prompt,
    get_schema_clarification_prompt,
    get_sql_fix_system_prompt,
    get_sql_fix_prompt,
)
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


# ---------------------------------------------------------------------------
# Schema formatting helpers
# ---------------------------------------------------------------------------

@lru_cache(maxsize=128)
def _cached_format_schema(schema_json: str, limit_tables: int, mentioned_table_names: tuple) -> str:
    meta_schema = json.loads(schema_json)
    all_tables = meta_schema.get("tables", [])
    mentioned_tables = None
    if mentioned_table_names:
        mentioned_tables = [t for t in all_tables if t.get("name") in mentioned_table_names]
    return format_schema_for_prompt(meta_schema, limit_tables, mentioned_tables)


def extract_mentioned_tables(message: str, all_tables: list) -> list:
    message_lower = message.lower()
    return [t for t in all_tables if t.get("name", "").lower() in message_lower]


def format_schema_for_prompt(meta_schema: dict, limit_tables: int = 10, mentioned_tables: list = None) -> str:
    if not meta_schema or "tables" not in meta_schema:
        return "No schema information available."
    all_tables = meta_schema.get("tables", [])
    if mentioned_tables:
        return _format_tables_detailed(mentioned_tables[:limit_tables])
    return _format_tables_compact(all_tables)


def _format_tables_detailed(tables: list) -> str:
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
                
        sample_data = table.get("sample_data", [])
        if sample_data:
            lines.append("  Sample Values:")
            for row in sample_data[:5]:
                lines.append(f"    {row}")
    return "\n".join(lines)


def _format_tables_compact(tables: list) -> str:
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
        
        sample_data = table.get("sample_data", [])
        if sample_data:
            lines.append(f"  Samples: {json.dumps(sample_data[:2], ensure_ascii=False)}")
            
    return "\n".join(lines)


def _extract_tables_from_sql(sql: str, all_tables: list) -> list:
    """Extract tables mentioned in SQL and return their full schema+sample."""
    sql_lower = sql.lower()
    return [t for t in all_tables if t.get("name", "").lower() in sql_lower]


def _format_tables_with_samples(tables: list) -> str:
    lines = ["Schema with actual sample data:"]
    for table in tables:
        name = table.get("name", "")
        columns = table.get("columns", [])
        lines.append(f"\nTable: {name}")
        lines.append("Columns:")
        for col in columns:
            col_type = col.get("type") or col.get("data_type", "unknown")
            lines.append(f"  - {col.get('name')}: {col_type}")

        sample_data = table.get("sample_data", [])
        if sample_data:
            lines.append(f"Sample values (actual data from DB, up to 5 rows):")
            for row in sample_data[:5]:
                lines.append(f"  {row}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# DB helpers: save messages, resolve conversation
# ---------------------------------------------------------------------------

async def _save_user_message(db: AsyncSession, conversation_id: UUID, message: str) -> None:
    await query_log_repository.create(
        db,
        obj_in={
            "conversation_id": conversation_id,
            "role": ChatRole.USER,
            "content": message,
            "created_at": datetime.now(timezone.utc),
        },
    )


async def _save_assistant_message(
    db: AsyncSession,
    conversation_id: UUID,
    content: str,
    sql_generated: Optional[str] = None,
    schema_generated: Optional[dict] = None,
) -> None:
    try:
        await db.rollback()
    except Exception:
        pass
    await query_log_repository.create(
        db,
        obj_in={
            "conversation_id": conversation_id,
            "role": ChatRole.ASSISTANT,
            "content": content,
            "sql_generated": sql_generated,
            "schema_generated": schema_generated if isinstance(schema_generated, dict) else None,
            "created_at": datetime.now(timezone.utc),
        },
    )


async def _resolve_conversation(db: AsyncSession, request: ChatCompletionRequest) -> UUID:
    if request.conversation_id:
        conversation = await conversation_repository.get(db, id=request.conversation_id)
        if not conversation or conversation.connection_id != request.connection_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return conversation.id

    conversation = await conversation_repository.create(
        db,
        obj_in={
            "connection_id": request.connection_id,
            "title": request.message[:50] + ("..." if len(request.message) > 50 else ""),
            "created_at": datetime.now(timezone.utc),
        },
    )
    return conversation.id


# ---------------------------------------------------------------------------
# CHECK MODE
# ---------------------------------------------------------------------------

_DIALECT_MAP = {
    "postgres": "postgres", "postgresql": "postgres",
    "mysql": "mysql", "mariadb": "mysql",
    "sqlite": "sqlite",
    "mssql": "tsql", "sqlserver": "tsql",
    "simulation": "postgres",
}


def _sqlglot_dialect(db_type_value: str) -> str:
    return _DIALECT_MAP.get((db_type_value or "").lower(), "postgres")


def _strip_sql_markdown(text: str) -> str:
    match = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.strip()


def _extract_sql_block(text: str) -> Optional[str]:
    match = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else None


def _check_syntax(sql: str, dialect: str):
    """Returns (is_valid: bool, errors: list[str], cleaned_sql: str)."""
    cleaned = _strip_sql_markdown(sql)
    if not cleaned:
        return False, ["Empty SQL statement"], ""
    
    try:
        sqlglot.parse(cleaned, read=dialect)
        return True, [], cleaned
    except sqlglot.errors.ParseError as e:
        return False, [str(e)], cleaned
    except Exception as e:
        return False, [str(e)], cleaned


async def _handle_check_mode(
    request: ChatCompletionRequest,
    connection,
    conversation_id: UUID,
    db: AsyncSession,
) -> ChatCompletionResponse:
    message = request.message
    db_type_value = connection.db_type.value if connection.db_type else "postgresql"
    dialect_key = _sqlglot_dialect(db_type_value)

    raw_sql = _strip_sql_markdown(message)
    is_valid, errors, cleaned_sql = _check_syntax(raw_sql, dialect_key)

    # ── Fast path: valid syntax → no LLM ──────────────────────────────────
    if is_valid:
        logger.info("[CHECK] Syntax valid — skipping LLM")
        content = f"**Status:** Valid\n**Issue:** None\n\n```sql\n{cleaned_sql}\n```"
        await _save_assistant_message(db, conversation_id, content, sql_generated=cleaned_sql)
        return ChatCompletionResponse(
            conversation_id=conversation_id,
            role="assistant",
            content=content,
            sql_generated=cleaned_sql,
            is_schema_design=False,
        )

    # ── Slow path: syntax errors → LLM fix ────────────────────────────────
    error_summary = "; ".join(errors[:3])
    logger.info("[CHECK] Errors: %s — calling LLM", error_summary)

    system_prompt = get_chat_check_system_prompt(db_type_value)
    user_prompt = (
        f"{get_chat_check_user_prompt(raw_sql)}\n\n"
        f"Detected issues: {error_summary}"
    )

    try:
        t0 = time.time()
        llm_response = await llm_service.chat(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=512,
        )
        logger.info("[CHECK] LLM fix took %.2fs", time.time() - t0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM service error: {str(e)}")

    fixed_sql = _extract_sql_block(llm_response)
    await _save_assistant_message(db, conversation_id, llm_response, sql_generated=fixed_sql)
    return ChatCompletionResponse(
        conversation_id=conversation_id,
        role="assistant",
        content=llm_response,
        sql_generated=fixed_sql,
        is_schema_design=False,
    )


# ---------------------------------------------------------------------------
# FIX MODE
# ---------------------------------------------------------------------------

async def _handle_fix_mode(
    request: ChatCompletionRequest,
    connection,
    conversation_id: UUID,
    db: AsyncSession,
) -> ChatCompletionResponse:

    original_sql = request.original_sql or _strip_sql_markdown(request.message)
    error_message = request.error_message or ""
    db_type_value = connection.db_type.value if connection.db_type else "postgresql"

    # 1. Xác định bảng nào liên quan từ SQL
    all_tables = connection.meta_schema.get("tables", []) if connection.meta_schema else []
    mentioned_tables = _extract_tables_from_sql(original_sql, all_tables)

    # 2. Build schema + sample data chỉ cho các bảng liên quan
    fix_schema_text = _format_tables_with_samples(mentioned_tables)

    # 3. Gọi LLM với prompt fix chuyên biệt
    system_prompt = get_sql_fix_system_prompt(db_type_value)
    user_prompt = get_sql_fix_prompt(
        original_sql=original_sql,
        error_message=error_message,
        schema_with_samples=fix_schema_text,
        user_hint=request.message,
    )

    llm_response = await llm_service.chat(
        prompt=user_prompt,
        system_prompt=system_prompt,
        temperature=0.1,
        max_tokens=1024,
    )

    fixed_sql = _extract_sql_block(llm_response)
    await _save_assistant_message(db, conversation_id, llm_response, sql_generated=fixed_sql)
    return ChatCompletionResponse(
        conversation_id=conversation_id,
        role="assistant",
        content=llm_response,
        sql_generated=fixed_sql,
        is_schema_design=False,
    )


# ---------------------------------------------------------------------------
# CHAT MODE
# ---------------------------------------------------------------------------

async def _handle_chat_mode(
    request: ChatCompletionRequest,
    connection,
    conversation_id: UUID,
    db: AsyncSession,
) -> ChatCompletionResponse:
    message = request.message
    db_type_value = connection.db_type.value if connection.db_type else "postgresql"

    # Build schema context
    all_tables = connection.meta_schema.get("tables", []) if connection.meta_schema else []
    mentioned_tables = extract_mentioned_tables(message, all_tables)
    schema_json = json.dumps(connection.meta_schema or {})
    mentioned_names = tuple(sorted([t.get("name") for t in mentioned_tables])) if mentioned_tables else ()
    schema_text = _cached_format_schema(schema_json, 10, mentioned_names)

    system_prompt = get_chat_generate_sql_system_prompt(db_type_value, schema_text)

    logger.info("[CHAT] mode=chat, dialect=%s, schema=%d bytes", db_type_value, len(schema_text))

    try:
        t0 = time.time()
        llm_response = await llm_service.chat(
            prompt=message,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=1024,
        )
        logger.info("[CHAT] LLM took %.2fs", time.time() - t0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM service error: {str(e)}")

    sql_generated = _extract_sql_block(llm_response)
    detected_sql = llm_service._extract_sql_from_message(message)

    await _save_assistant_message(db, conversation_id, llm_response, sql_generated=sql_generated)

    response_data: Dict[str, Any] = {
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": llm_response,
        "sql_generated": sql_generated,
        "is_schema_design": False,
    }
    if detected_sql:
        response_data["detected_sql"] = detected_sql
    return ChatCompletionResponse(**response_data)


# ---------------------------------------------------------------------------
# GEN MODE
# ---------------------------------------------------------------------------

def _is_schema_design_intent(message: str) -> bool:
    message_lower = message.lower()
    keywords = [
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
    return any(k in message_lower for k in keywords)


def _extract_first_json_object(text: str) -> str:
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
                return text[start: i + 1]
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
    has_specific = any(kw in message.lower() for kw in specific_keywords)

    if word_count >= SCHEMA_DESIGN_MIN_WORDS_FOR_DIRECT_GENERATE and has_specific:
        logger.info("[GEN] Clarification skipped: %d words, specific=%s", word_count, has_specific)
        return {"needs_clarification": False, "questions": []}

    try:
        context_prompt = get_schema_clarification_prompt(message)
        raw = await llm_service.chat(prompt=context_prompt, system_prompt=None, temperature=0.1, max_tokens=512)
        clean = re.sub(r"```(?:json)?\s*|```", "", raw).strip()
        result = json.loads(_extract_first_json_object(clean))
        logger.info("[GEN] Clarification: needs=%s, q=%d", result.get("needs_clarification"), len(result.get("questions", [])))
        return result
    except Exception as e:
        logger.warning("[GEN] Clarification check failed: %s", e)
        return {"needs_clarification": False, "questions": []}


async def _handle_gen_mode(
    request: ChatCompletionRequest,
    conversation_id: UUID,
    db: AsyncSession,
) -> ChatCompletionResponse:
    message = request.message
    has_answers = bool(request.clarification_answers)

    if not has_answers:
        clarification_check = await _check_schema_clarification_inline(message)
        if clarification_check.get("needs_clarification") and clarification_check.get("questions"):
            questions = clarification_check["questions"]
            clarification_content = (
                "Before designing the schema, I have a few questions:\n\n"
                + "\n".join(
                    f"{idx + 1}. {q.get('q', '')}"
                    + (f"\n   Options: {', '.join(q.get('options', []))}" if q.get("options") else "")
                    for idx, q in enumerate(questions)
                )
                + "\n\nPlease answer these questions and I'll generate the schema."
            )
            await _save_assistant_message(db, conversation_id, clarification_content)
            return ChatCompletionResponse(
                conversation_id=conversation_id,
                role="assistant",
                content=clarification_content,
                is_schema_design=False,
                schema_generated=None,
            )

    schema_prompt = get_chat_schema_design_prompt(
        user_description=message,
        clarification_answers=request.clarification_answers,
    )
    logger.info("[GEN] Generating schema, prompt_len=%d", len(schema_prompt))

    try:
        t0 = time.time()
        llm_response = await llm_service.chat_schema_design(
            prompt=schema_prompt,
            system_prompt=CHAT_SCHEMA_DESIGN_SYSTEM_PROMPT,
        )
        logger.info("[GEN] LLM took %.2fs", time.time() - t0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM service error: {str(e)}")

    schema_generated = None
    llm_response_for_content = llm_response
    try:
        clean = re.sub(r"```(?:json)?\s*|```", "", llm_response).strip()
        schema_generated = json.loads(_extract_first_json_object(clean))
        tables = schema_generated.get("tables", [])
        table_names = ", ".join(t.get("name", "") for t in tables[:6] if t.get("name"))
        llm_response_for_content = (
            f"I've designed a {schema_generated.get('system_name', 'database')} "
            f"schema with {len(tables)} tables"
            + (f": {table_names}. " if table_names else ". ")
            + "Review the schema below and click Apply to Sandbox to use it."
        )
        logger.info("[GEN] Schema parsed: %d tables", len(tables))
    except Exception as e:
        logger.warning("[GEN] Failed to parse schema JSON: %s", e)

    await _save_assistant_message(db, conversation_id, llm_response_for_content, schema_generated=schema_generated)
    return ChatCompletionResponse(
        conversation_id=conversation_id,
        role="assistant",
        content=llm_response_for_content,
        is_schema_design=True,
        schema_generated=schema_generated,
    )


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/completion", response_model=ChatCompletionResponse)
async def chat_completion(
    request: ChatCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=request.connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found or access denied")

    conversation_id = await _resolve_conversation(db, request)
    await _save_user_message(db, conversation_id, request.message)

    chat_mode = request.chat_mode
    logger.info("[DISPATCH] mode=%s conv=%s", chat_mode, conversation_id)

    if chat_mode == "check":
        return await _handle_check_mode(request, connection, conversation_id, db)

    if chat_mode == "gen":
        return await _handle_gen_mode(request, conversation_id, db)

    if chat_mode == "fix":
        return await _handle_fix_mode(request, connection, conversation_id, db)

    # Default: "chat"
    return await _handle_chat_mode(request, connection, conversation_id, db)


# ---------------------------------------------------------------------------
# Conversation management (unchanged)
# ---------------------------------------------------------------------------

@router.get("/conversations/{connection_id}")
async def get_conversations(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")

    conversations = await conversation_repository.get_by_connection(db=db, connection_id=connection_id)
    return [
        {
            "id": str(conv.id),
            "title": conv.title,
            "created_at": conv.created_at.isoformat(),
            "updated_at": (
                conv.updated_at.isoformat()
                if hasattr(conv, "updated_at") and conv.updated_at
                else conv.created_at.isoformat()
            ),
        }
        for conv in conversations
    ]


@router.patch("/conversations/{conversation_id}/rename")
async def rename_conversation(
    conversation_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await conversation_repository.get(db, id=conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=conversation.connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    new_title = body.get("title", "").strip()
    if not new_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title cannot be empty")

    updated = await conversation_repository.update(db, db_obj=conversation, obj_in={"title": new_title})
    return {"id": str(updated.id), "title": updated.title}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await conversation_repository.get(db, id=conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=conversation.connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    deleted = await conversation_repository.delete(db, id=conversation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete conversation")

    return {"success": True, "id": str(conversation_id)}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await conversation_repository.get(db, id=conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=conversation.connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    messages = await query_log_repository.get_by_conversation(db=db, conversation_id=conversation_id)
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
    db: AsyncSession = Depends(get_db),
):
    message = await query_log_repository.get(db, id=message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    conversation = await conversation_repository.get(db, id=message.conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    connection = await connection_repository.get_by_user_and_id(
        db=db, user_id=current_user.id, connection_id=conversation.connection_id
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated_sql = body.get("sql_generated")
    if updated_sql is not None:
        updated = await query_log_repository.update(db, db_obj=message, obj_in={"sql_generated": updated_sql})
        return {"id": str(updated.id), "sql_generated": updated.sql_generated}

    return {"id": str(message.id)}