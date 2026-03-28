# Fix tốc độ: từ 5+ phút xuống ~2.5 phút

## Root cause chính xác

**Tốc độ chậm:**
`BATCH_SIZE=1` → 5 tables = **5 sequential LLM calls** × ~55s/call = 275s chỉ
riêng Phase 2. Cộng Phase 1 ~60s = **~335s ≈ 5.6 phút**.

Ollama xử lý sequential → concurrent requests không giúp được.

**Giải pháp:** Gộp tất cả tables vào **1 call duy nhất** cho Phase 2.
Token budget analysis xác nhận khả thi:
- Input: Phase2 system prompt (~365 tokens) + 5 table descriptions (~320 tokens) = ~685 tokens
- Output cần: 5 tables × ~220 tokens/table = ~1100 tokens
- Tổng: ~1785 tokens → fit trong `num_ctx=3072`
- Result: Phase1(~60s) + Phase2(~90s) = **~150s ≈ 2.5 phút**

**Clarification options vẫn ALL_CAPS:**
Prompt dùng placeholder `DOMAIN_SPECIFIC_MODULE_*` dạng SCREAMING_SNAKE_CASE
→ model copy style → options ra `BOOK_MANAGEMENT`, `MEMBER_REGISTRATION`.
Cần đổi placeholder sang format human-readable.

---

## Fix 1 — `generate_schema_two_phase` trong `backend/app/services/llm_service.py`

### Thay đổi: bỏ vòng lặp batch, gộp tất cả tables vào 1 call

Tìm toàn bộ đoạn Phase 2 (từ `# Phase 2: enrich columns per batch` đến hết
vòng lặp `for batch_idx`), thay thế bằng:

~~~python
        # Phase 2: enrich ALL tables in a single call
        all_lines = []
        for t in tables_raw:
            fk_refs = t.get("has_fk_to", [])
            fk_info = f", FK to: {', '.join(fk_refs)}" if fk_refs else ""
            key_cols = t.get("key_columns", [])
            cols_hint = (
                f", include columns: {', '.join(key_cols)}" if key_cols else ""
            )
            all_lines.append(
                f'Table "{t["name"]}": {t.get("purpose", "")}{fk_info}{cols_hint}'
            )

        phase2_prompt = (
            f"System: {description}"
            + (
                f"\nUser requirements: {clarification_context.strip()}"
                if clarification_context.strip()
                else ""
            )
            + f"\n\nGenerate columns for ALL these tables:\n"
            + "\n".join(all_lines)
        )

        logger.info(
            "[SCHEMA-2P] Phase 2 — single call for %d tables: %s",
            len(tables_raw),
            [t.get("name") for t in tables_raw],
        )

        enriched_tables: list[dict] = []

        try:
            phase2_raw = await self._call_ollama_with_timeout(
                prompt=phase2_prompt,
                system_prompt=SCHEMA_PHASE2_SYSTEM_PROMPT,
                max_tokens=1300,      # đủ cho ~5-6 tables với 6-7 cols mỗi table
                read_timeout=180.0,   # single call lớn hơn → timeout cao hơn
                num_ctx=3072,         # đủ cho input + output
            )
            clean2 = re.sub(r"```(?:json)?\s*|```", "", phase2_raw).strip()
            parsed2 = json.loads(self._extract_json_object(clean2))
            batch_result = parsed2.get("tables", [])

            if not batch_result:
                raise ValueError("Phase 2 response missing 'tables' key or empty")

            for table in batch_result:
                if not isinstance(table, dict) or "name" not in table:
                    raise ValueError("Invalid table object in response")
                cols = table.get("columns", [])
                if not isinstance(cols, list) or len(cols) < 3:
                    raise ValueError(
                        f"Table '{table.get('name')}' has only {len(cols)} columns"
                    )

            enriched_tables.extend(batch_result)
            logger.info(
                "[SCHEMA-2P] Phase 2 done: %d tables enriched",
                len(enriched_tables),
            )

        except Exception as e:
            logger.warning(
                "[SCHEMA-2P] Phase 2 failed: %s — using key_columns fallback for all tables",
                e,
            )
            # Fallback: dùng key_columns từ Phase 1 với type inference
            for t in tables_raw:
                fallback_cols = [
                    {"name": "id", "type": "UUID", "is_pk": True,
                     "is_nullable": False, "default": None},
                    {"name": "created_at", "type": "TIMESTAMP", "is_pk": False,
                     "is_nullable": False, "default": None},
                ]
                for col_name in t.get("key_columns", []):
                    if col_name.endswith("_id"):
                        col_type = "UUID"
                    elif any(k in col_name for k in ["price", "amount", "total", "cost", "salary", "fee"]):
                        col_type = "DECIMAL(10,2)"
                    elif any(k in col_name for k in ["count", "quantity", "age", "number", "stock"]):
                        col_type = "INTEGER"
                    elif any(k in col_name for k in ["is_", "has_", "active", "enabled", "available"]):
                        col_type = "BOOLEAN"
                    elif any(k in col_name for k in ["date", "time", "_at", "due", "expiry"]):
                        col_type = "TIMESTAMP"
                    elif any(k in col_name for k in ["description", "notes", "content", "text", "detail"]):
                        col_type = "TEXT"
                    else:
                        col_type = "VARCHAR(255)"
                    fallback_cols.append({
                        "name": col_name,
                        "type": col_type,
                        "is_pk": False,
                        "is_nullable": True,
                        "default": None,
                    })
                enriched_tables.append({
                    "name": t["name"],
                    "purpose": t.get("purpose", ""),
                    "design_rationale": t.get("purpose", ""),
                    "columns": fallback_cols,
                    "foreign_keys": [],
                    "indexes": [],
                })
~~~

---

## Fix 2 — `CHAT_SCHEMA_CLARIFICATION_PROMPT` trong `backend/app/core/prompts.py`

**Vấn đề:** Placeholder `DOMAIN_SPECIFIC_MODULE_*` dạng ALL_CAPS → model copy
style → options ra `BOOK_MANAGEMENT` thay vì `Book management`.

**Fix:** Đổi placeholder sang lowercase với spaces, và instruction rõ ràng hơn.

Tìm phần cuối của `CHAT_SCHEMA_CLARIFICATION_PROMPT` (đoạn example JSON),
thay thế 2 dòng cuối:

~~~python
# TRƯỚC (2 dòng cuối của prompt):
  {{\"q\": \"Which components should be included in this system?\",
    \"options\": [\"DOMAIN_SPECIFIC_MODULE_1\", \"DOMAIN_SPECIFIC_MODULE_2\", \"DOMAIN_SPECIFIC_MODULE_3\", \"DOMAIN_SPECIFIC_MODULE_4\", \"DOMAIN_SPECIFIC_MODULE_5\"]}},
  {{\"q\": \"DOMAIN_SPECIFIC_YES_NO_QUESTION?\",
    \"options\": [\"Yes\", \"No\", \"Partially\"]}}
]}}\n\nReplace DOMAIN_SPECIFIC_MODULE_* with actual module names for: {description}\nReplace DOMAIN_SPECIFIC_YES_NO_QUESTION with actual business rule question for: {description}

# SAU — thay bằng:
  {{\"q\": \"Which features or components should this system manage?\",
    \"options\": [\"feature name 1\", \"feature name 2\", \"feature name 3\", \"feature name 4\", \"feature name 5\"]}},
  {{\"q\": \"Specific yes/no business rule question for this domain?\",
    \"options\": [\"Yes\", \"No\", \"Partially\"]}}
]}}

IMPORTANT: Replace the placeholder values above with real domain-specific content:
- Replace \"feature name 1\" through \"feature name 5\" with 5 actual feature/module names
  relevant to: {description}
  Use short, readable names like \"Book catalog\", \"Member registration\", \"Loan tracking\"
  NOT all-caps codes like \"BOOK_MANAGEMENT\" or \"MEMBER_REG\"
- Replace \"Specific yes/no business rule question\" with a real question about
  a structural decision in: {description}
  Example: \"Should overdue penalties be tracked per loan?\" not generic yes/no
~~~

---

## Thay đổi nhỏ bổ sung trong `generate_schema_two_phase`

### Thêm `import asyncio` vào đầu file (nếu chưa có)

Tìm dòng `import json` ở đầu `llm_service.py`, thêm sau:
~~~python
import asyncio
~~~

*(Không dùng asyncio.gather ngay bây giờ vì Ollama sequential, nhưng cần cho
future optimization)*

---

## Checklist

- [ ] `llm_service.py` — bỏ `BATCH_SIZE` và vòng lặp for batch, thay bằng single Phase 2 call
- [ ] Phase 2 call: `max_tokens=1300`, `read_timeout=180.0`, `num_ctx=3072`
- [ ] Fallback: xử lý tất cả `tables_raw` trong 1 except block (không còn per-batch)
- [ ] `prompts.py` — `CHAT_SCHEMA_CLARIFICATION_PROMPT`: đổi placeholder từ ALL_CAPS sang lowercase với spaces
- [ ] **Test thời gian:** Log từ request đến response phải ≤ 3 phút cho 5-6 tables
- [ ] **Test options:** "quản lý thư viện" → options phải là "Book catalog", "Member registration" (không phải "BOOK_MANAGEMENT")
- [ ] **Test columns:** Tất cả tables phải có ≥ 3 domain columns (không còn fallback 2 cột)
- [ ] **Test Phase 2 fail:** Nếu single call fail → fallback vẫn sinh đủ columns từ key_columns