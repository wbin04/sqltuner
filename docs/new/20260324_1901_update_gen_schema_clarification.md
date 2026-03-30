# Task: Cải thiện Schema Generation — Clarification thông minh + 2-phase generation

## Tổng quan 2 thay đổi

1. **Clarification context-aware** — câu hỏi phải phụ thuộc vào domain của user, không generic
2. **2-phase schema generation** — Phase 1: list tables → Phase 2: enrich columns per batch
   → giải quyết conflict giữa muốn nhiều bảng (đủ cấu trúc) vs phải ít token (không truncate)

---

## Thay đổi 1: `backend/app/core/prompts.py`

### 1a. Thay thế `CHAT_SCHEMA_CLARIFICATION_PROMPT`

Tìm và thay thế hoàn toàn constant `CHAT_SCHEMA_CLARIFICATION_PROMPT` hiện tại:

~~~python
CHAT_SCHEMA_CLARIFICATION_PROMPT = """\
CRITICAL: Output RAW JSON only. No markdown. No text outside JSON.

You are a senior database architect reviewing a schema design request.
The user has described a system they want to build. Your job is to identify
if there are GENUINE design ambiguities that would significantly change the schema.

WHAT TO NEVER ASK (these are always assumed):
- Basic CRUD operations (create, read, update, delete) — every system needs them
- What database engine to use — not relevant to schema structure
- How many users — only affects indexing, not schema
- Whether to use SQL — already decided

WHAT TO ASK ABOUT (only if genuinely unclear from the description):
- Relationships: "Can X belong to multiple Y?" → affects junction table
- Business rules: "Is Z unique per user or globally?" → affects constraints
- Missing key entities: "Do you need to track [specific entity]?" → affects table count
- Hierarchy: "Do categories have subcategories?" → affects self-referencing table
- Temporal: "Should history be kept after deletion?" → affects soft delete

EVALUATION RULES:
- If description mentions 3+ specific domain entities → needs_clarification: false
- If description is under 8 words or mentions only 1 generic concept → ask 1-2 questions
- Questions must be YES/NO or multiple choice — never open-ended
- Max 2 questions. Each question must change the schema structure if answered differently.

User's description: "{description}"

Output JSON (choose one):
If clear enough: {{"needs_clarification": false, "questions": []}}
If ambiguous: {{"needs_clarification": true, "questions": [{{"q": "specific question about {description}", "options": ["concrete option A", "concrete option B", "Both", "Neither"]}}]}}
"""
~~~

### 1b. Thêm function `get_schema_clarification_prompt`

Thêm function mới ngay sau constant trên:

~~~python
def get_schema_clarification_prompt(description: str) -> str:
    """Inject user description vào clarification prompt."""
    return CHAT_SCHEMA_CLARIFICATION_PROMPT.replace("{description}", description)
~~~

### 1c. Thêm 2 constants mới cho 2-phase generation

Thêm sau `CHAT_SCHEMA_CLARIFICATION_PROMPT`:

~~~python
SCHEMA_PHASE1_SYSTEM_PROMPT = """\
CRITICAL: Output RAW JSON only. No markdown. No text outside JSON.

You are a database architect. Your task is ONLY to list the tables needed.
Do NOT add columns yet — columns will be added in a separate step.

RULES:
- List ALL tables including junction tables for many-to-many relationships
- Max 8 tables total
- "has_fk_to" lists table names this table has foreign keys pointing to
- Keep purpose to one clear sentence

OUTPUT FORMAT — exactly this structure:
{
  "system_name": "CamelCaseName",
  "tables": [
    {
      "name": "snake_case_name",
      "purpose": "one sentence describing what this table stores",
      "has_fk_to": ["other_table_name"]
    }
  ],
  "design_notes": ["one key design decision worth noting"]
}
"""


SCHEMA_PHASE2_SYSTEM_PROMPT = """\
CRITICAL: Output a RAW JSON ARRAY only. Start with [ and end with ]. No markdown. No text outside JSON.

You are adding columns to database tables. For EACH table given, provide appropriate columns.

MANDATORY columns for EVERY table (always include these first):
- id: UUID, PRIMARY KEY, NOT NULL
- created_at: TIMESTAMP, NOT NULL

COLUMN TYPE GUIDE:
- Short text (names, titles, codes): VARCHAR(255)
- Long text (descriptions, notes, content): TEXT
- Whole numbers (counts, quantities, ages): INTEGER
- Money / precise decimals: DECIMAL(10,2)
- True/False flags: BOOLEAN
- Dates with time: TIMESTAMP
- Foreign keys (references to other tables): UUID
- Unique identifiers: UUID

OUTPUT FORMAT — JSON array, one object per table:
[
  {
    "name": "exact_table_name",
    "columns": [
      {"name": "id", "type": "UUID", "is_pk": true, "is_nullable": false, "default": null},
      {"name": "created_at", "type": "TIMESTAMP", "is_pk": false, "is_nullable": false, "default": null},
      {"name": "column_name", "type": "APPROPRIATE_TYPE", "is_pk": false, "is_nullable": true, "default": null}
    ],
    "foreign_keys": [
      {"column": "ref_id", "ref_table": "referenced_table", "ref_column": "id", "on_delete": "CASCADE"}
    ],
    "indexes": [
      {"name": "idx_tablename_colname", "column_names": ["col"], "unique": false}
    ]
  }
]
"""
~~~

---

## Thay đổi 2: `backend/app/services/llm_service.py`

### 2a. Thêm static helper `_extract_json_object`

Thêm static method vào class `LLMService`, đặt sau `__init__`:

~~~python
@staticmethod
def _extract_json_object(text: str) -> str:
    """Extract first complete JSON object {…} from text, ignoring surrounding content."""
    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON object found in text")
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
                continue
            if ch == '\\':
                escaped = True
                continue
            if ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    raise ValueError("Unclosed JSON object in text")


@staticmethod
def _extract_json_array(text: str) -> str:
    """Extract first complete JSON array […] from text, ignoring surrounding content."""
    start = text.find('[')
    if start == -1:
        raise ValueError("No JSON array found in text")
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
                continue
            if ch == '\\':
                escaped = True
                continue
            if ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    raise ValueError("Unclosed JSON array in text")
~~~

### 2b. Thêm method `_call_ollama_with_timeout`

Thêm helper để gọi Ollama với custom timeout, dùng cho Phase 1 và Phase 2:

~~~python
async def _call_ollama_with_timeout(
    self,
    prompt: str,
    system_prompt: str,
    max_tokens: int,
    read_timeout: float = 120.0,
    json_mode: bool = True,
) -> str:
    """Gọi Ollama với custom read timeout — dùng cho các call nhỏ trong 2-phase."""
    url = self._build_api_url()
    payload_config = OllamaPayload(
        model=self.chat_model,
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.1,
        num_ctx=2048,
        num_predict=max_tokens,
        json_mode=json_mode,
    )
    payload = payload_config.to_dict()
    payload["keep_alive"] = "120m"

    timeout_config = httpx.Timeout(
        connect=LLM_HTTP_CONNECT_TIMEOUT,
        read=read_timeout,
        write=LLM_HTTP_WRITE_TIMEOUT,
        pool=LLM_HTTP_POOL_TIMEOUT,
    )

    async with httpx.AsyncClient(timeout=timeout_config) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        result = response.json().get("response", "").strip()
        logger.info("[LLM-2P] Response received, length=%s", len(result))
        return result
~~~

### 2c. Thêm method `generate_schema_two_phase`

Đây là method chính. Thêm vào class `LLMService`, đặt trước `chat_schema_design`:

~~~python
async def generate_schema_two_phase(
    self,
    description: str,
    clarification_context: str = "",
) -> dict:
    """
    2-phase schema generation để tránh token truncation với model nhỏ.

    Phase 1: Generate table list + relationships (~300 tokens)
    Phase 2: Enrich columns per batch of 2 tables (~600 tokens per batch)
    Merge: Combine Phase 1 structure + Phase 2 columns → complete schema
    """
    from app.core.prompts import (
        SCHEMA_PHASE1_SYSTEM_PROMPT,
        SCHEMA_PHASE2_SYSTEM_PROMPT,
    )

    # ── PHASE 1: Generate table structure ────────────────────────────────
    phase1_prompt = (
        f"List the tables needed for this system: {description}"
        f"{clarification_context}"
    )

    logger.info("[SCHEMA-2P] Phase 1 starting — description: %s...", description[:60])

    try:
        phase1_raw = await self._call_ollama_with_timeout(
            prompt=phase1_prompt,
            system_prompt=SCHEMA_PHASE1_SYSTEM_PROMPT,
            max_tokens=500,
            read_timeout=120.0,
        )
        clean1 = re.sub(r"```(?:json)?\s*|```", "", phase1_raw).strip()
        structure = json.loads(self._extract_json_object(clean1))
        tables_raw = structure.get("tables", [])

        if not tables_raw:
            raise ValueError("Phase 1 returned empty tables list")

        logger.info(
            "[SCHEMA-2P] Phase 1 done: %s tables: %s",
            len(tables_raw),
            [t.get("name") for t in tables_raw],
        )
    except Exception as e:
        logger.error("[SCHEMA-2P] Phase 1 failed: %s", e)
        raise ValueError(f"Schema structure generation failed: {e}")

    # ── PHASE 2: Enrich columns per batch ────────────────────────────────
    BATCH_SIZE = 2
    enriched_tables: list[dict] = []

    for batch_idx in range(0, len(tables_raw), BATCH_SIZE):
        batch = tables_raw[batch_idx:batch_idx + BATCH_SIZE]

        # Build context: tên + purpose + FK info cho batch này
        batch_lines = []
        for t in batch:
            fk_refs = t.get("has_fk_to", [])
            fk_info = f", references: {', '.join(fk_refs)}" if fk_refs else ""
            batch_lines.append(
                f'Table "{t["name"]}": {t.get("purpose", "")}{fk_info}'
            )

        phase2_prompt = (
            f"System context: {description}\n\n"
            f"Add columns to these tables:\n"
            + "\n".join(batch_lines)
        )

        logger.info(
            "[SCHEMA-2P] Phase 2 batch %d/%d: tables=%s",
            batch_idx // BATCH_SIZE + 1,
            (len(tables_raw) + BATCH_SIZE - 1) // BATCH_SIZE,
            [t["name"] for t in batch],
        )

        try:
            phase2_raw = await self._call_ollama_with_timeout(
                prompt=phase2_prompt,
                system_prompt=SCHEMA_PHASE2_SYSTEM_PROMPT,
                max_tokens=700,
                read_timeout=180.0,
            )
            clean2 = re.sub(r"```(?:json)?\s*|```", "", phase2_raw).strip()
            batch_result = json.loads(self._extract_json_array(clean2))

            # Validate: mỗi table phải có columns
            for table in batch_result:
                cols = table.get("columns", [])
                if not isinstance(cols, list) or len(cols) < 2:
                    raise ValueError(
                        f"Table '{table.get('name')}' has insufficient columns"
                    )

            enriched_tables.extend(batch_result)

        except Exception as e:
            logger.warning(
                "[SCHEMA-2P] Phase 2 batch %d failed: %s — using minimal fallback",
                batch_idx // BATCH_SIZE + 1, e,
            )
            # Fallback: thêm table với 2 columns bắt buộc
            for t in batch:
                enriched_tables.append({
                    "name": t["name"],
                    "purpose": t.get("purpose", ""),
                    "design_rationale": t.get("purpose", ""),
                    "columns": [
                        {
                            "name": "id",
                            "type": "UUID",
                            "is_pk": True,
                            "is_nullable": False,
                            "default": None,
                        },
                        {
                            "name": "created_at",
                            "type": "TIMESTAMP",
                            "is_pk": False,
                            "is_nullable": False,
                            "default": None,
                        },
                    ],
                    "foreign_keys": [],
                    "indexes": [],
                })

    # ── MERGE: Gắn purpose/rationale từ Phase 1 vào Phase 2 results ─────
    phase1_map = {t["name"]: t for t in tables_raw}

    final_tables = []
    for table in enriched_tables:
        p1_info = phase1_map.get(table["name"], {})
        table["purpose"] = table.get("purpose") or p1_info.get("purpose", "")
        table["design_rationale"] = (
            table.get("design_rationale") or p1_info.get("purpose", "")
        )
        final_tables.append(table)

    # Build relationships từ has_fk_to trong Phase 1
    relationships = []
    for t in tables_raw:
        for ref_table in t.get("has_fk_to", []):
            relationships.append({
                "from_table": t["name"],
                "to_table": ref_table,
                "type": "many_to_one",
                "description": f"{t['name']} references {ref_table}",
            })

    logger.info(
        "[SCHEMA-2P] Complete: %s tables, %s relationships",
        len(final_tables), len(relationships),
    )

    return {
        "system_name": structure.get("system_name", "GeneratedSchema"),
        "tables": final_tables,
        "relationships": relationships,
        "design_notes": structure.get("design_notes", []),
    }
~~~

### 2d. Thay thế `chat_schema_design` để gọi `generate_schema_two_phase`

Tìm method `chat_schema_design` hiện tại và thay thế toàn bộ body:

~~~python
async def chat_schema_design(
    self,
    prompt: str,
    system_prompt: Optional[str] = None,  # kept for API compatibility, unused
) -> str:
    """
    Entry point cho schema design từ chat.
    Parse description + clarification context từ prompt,
    gọi generate_schema_two_phase, trả về JSON string.
    """
    # Parse description và clarification context
    # prompt format từ get_chat_schema_design_prompt():
    # "Design a database schema for: {desc}\n\nAdditional context:\n{pairs}"
    description = prompt
    clarification_context = ""

    prefix = "Design a database schema for: "
    context_marker = "\n\nAdditional context:\n"

    if prompt.startswith(prefix):
        body = prompt[len(prefix):]
        if context_marker in body:
            parts = body.split(context_marker, 1)
            description = parts[0].strip()
            clarification_context = f"{context_marker}{parts[1]}"
        else:
            description = body.strip()

    result = await self.generate_schema_two_phase(
        description=description,
        clarification_context=clarification_context,
    )
    return json.dumps(result, ensure_ascii=False)
~~~

---

## Thay đổi 3: `backend/app/api/v1/endpoints/chat.py`

### 3a. Cập nhật `_check_schema_clarification_inline`

Tìm function `_check_schema_clarification_inline` và thay thế toàn bộ:

~~~python
async def _check_schema_clarification_inline(message: str) -> dict:
    """
    Check xem schema request có cần clarification không.
    - Dùng heuristic trước để tránh gọi LLM thêm 1 round-trip
    - Nếu message đủ rõ (nhiều từ + keyword domain) → skip
    - Nếu mơ hồ → gọi LLM với context-aware prompt
    """
    word_count = len(message.split())

    specific_keywords = [
        # Tiếng Việt
        "quản lý", "bán hàng", "đặt hàng", "khách hàng", "sản phẩm",
        "nhân viên", "kho hàng", "thanh toán", "thành viên", "đăng ký",
        "nhà cung cấp", "danh mục", "đơn hàng", "hoá đơn", "tồn kho",
        # Tiếng Anh
        "manage", "store", "order", "customer", "product",
        "employee", "inventory", "payment", "member", "register",
        "library", "hospital", "school", "restaurant", "hotel",
        "supplier", "category", "invoice", "booking", "reservation",
    ]

    has_specific = any(kw in message.lower() for kw in specific_keywords)

    # Heuristic: đủ dài + có keyword domain → skip clarification
    if word_count >= SCHEMA_DESIGN_MIN_WORDS_FOR_DIRECT_GENERATE and has_specific:
        logger.info(
            "[CHAT] Clarification skipped by heuristic: %d words, has_specific=%s",
            word_count, has_specific,
        )
        return {"needs_clarification": False, "questions": []}

    # Gọi LLM với prompt đã inject description
    try:
        from app.core.prompts import get_schema_clarification_prompt
        context_prompt = get_schema_clarification_prompt(message)

        raw = await llm_service.chat(
            prompt=context_prompt,  # prompt đã self-contained, không cần system_prompt riêng
            system_prompt=None,
            temperature=0.1,
            max_tokens=200,
        )
        clean = re.sub(r"```(?:json)?\s*|```", "", raw).strip()
        json_str = _extract_first_json_object(clean)
        result = json.loads(json_str)

        logger.info(
            "[CHAT] Clarification check result: needs=%s, questions=%d",
            result.get("needs_clarification"),
            len(result.get("questions", [])),
        )
        return result

    except Exception as e:
        logger.warning("[CHAT] Clarification check failed: %s — skipping", e)
        return {"needs_clarification": False, "questions": []}
~~~

### 3b. Import thêm trong `chat.py`

Đảm bảo import `get_schema_clarification_prompt` (đã thêm ở bước 1b).
Tìm dòng import từ `app.core.prompts` và bổ sung:

~~~python
from app.core.prompts import (
    CHAT_GENERAL_SYSTEM_PROMPT,
    CHAT_SCHEMA_CLARIFICATION_PROMPT,
    CHAT_SCHEMA_DESIGN_SYSTEM_PROMPT,
    get_chat_schema_design_prompt,
    get_chat_sql_system_prompt,
    get_schema_clarification_prompt,   # thêm mới
)
~~~

---

## Checklist

- [ ] `prompts.py` — `CHAT_SCHEMA_CLARIFICATION_PROMPT` thay thế bằng version inject `{description}`
- [ ] `prompts.py` — `get_schema_clarification_prompt(description)` function mới
- [ ] `prompts.py` — `SCHEMA_PHASE1_SYSTEM_PROMPT` constant mới
- [ ] `prompts.py` — `SCHEMA_PHASE2_SYSTEM_PROMPT` constant mới
- [ ] `llm_service.py` — `_extract_json_object` static method
- [ ] `llm_service.py` — `_extract_json_array` static method
- [ ] `llm_service.py` — `_call_ollama_with_timeout` helper method
- [ ] `llm_service.py` — `generate_schema_two_phase` method
- [ ] `llm_service.py` — `chat_schema_design` body thay thế để gọi `generate_schema_two_phase`
- [ ] `chat.py` — `_check_schema_clarification_inline` thay thế toàn bộ
- [ ] `chat.py` — import thêm `get_schema_clarification_prompt`

### Test cases

- [ ] "tạo database" (2 từ) → hỏi clarification với câu hỏi domain-specific (không hỏi "what operations?")
- [ ] "tôi muốn tạo database quản lý cửa hàng tạp hoá" → hỏi 1-2 câu về relationship hoặc entity cụ thể
- [ ] "tôi muốn tạo database quản lý thư viện với sách, thành viên, mượn trả và phạt quá hạn" (dài, rõ) → skip clarification, generate thẳng
- [ ] Sau clarification → schema có đủ cột (không phải 0 cols)
- [ ] Schema 6+ tables → tất cả tables đều có columns (Phase 2 enrich đủ)
- [ ] Phase 2 batch fail → fallback table vẫn có `id` và `created_at`
- [ ] Reload conversation → SchemaBlock vẫn hiện đúng (schema_generated từ DB)