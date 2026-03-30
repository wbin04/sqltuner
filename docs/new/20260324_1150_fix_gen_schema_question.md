# Task: Fix Generate Schema — columns mất, FK mất, xử lý chậm, thiếu clarify step

## Context codebase

**Stack:** FastAPI + React 18 + TypeScript + Ollama (qwen2.5:3b)

**Schema generate flow hiện tại:**
- `POST /schema-generator/check-clarification` → check xem description có cần hỏi thêm không
- `POST /schema-generator/generate` → sinh JSON schema → trả về `schema_def`, `relationships`, `table_summaries`, ...
- `GenerateSchemaModal.tsx`: 3-step modal (input → clarify → preview → apply)
- `handleApplyGeneratedSchema` trong `TableEditor.tsx`: nhận `schema_def` → build `SimulationSchema` với UUID → set vào state
- `SchemaBlock.tsx`: render schema từ chat message, có nút "Apply to Sandbox"

**Vấn đề hiện tại:**

| # | Vấn đề | File liên quan |
|---|--------|----------------|
| 1 | Columns bị mất (hiện `0 cols`) sau khi apply | `GenerateSchemaModal.tsx`, `TableEditor.tsx` |
| 2 | FK/relationships không được áp dụng vào Sandbox | `GenerateSchemaModal.tsx`, `TableEditor.tsx` |
| 3 | Xử lý mất ~60–90 giây (2 LLM calls tuần tự) | `GenerateSchemaModal.tsx` |
| 4 | Bỏ qua bước clarify khi description đủ rõ | `GenerateSchemaModal.tsx` |

---

## Fix 1 + 2: Sửa data flow — columns và FK bị mất khi apply

**File:** `frontend/src/components/simulation/GenerateSchemaModal.tsx`

**Nguyên nhân:**
- `onApply` đang truyền `result.schema_def` — chỉ chứa `{ tables: [...] }` thuần túy, mất `system_name`, `relationships`, `design_notes`
- Interface `GenerateResult` khai báo `schema_def: { tables?: unknown[] }` — type `unknown[]` khiến toàn bộ nested data (columns, foreign_keys, indexes) bị mất thông tin khi deserialize

**Bước 1** — Cập nhật interface `GenerateResult` để dùng đúng type thay vì `unknown[]`:

~~~tsx
import type { BackendTable } from '../../types/simulation';

// TRƯỚC
interface GenerateResult {
  system_name: string;
  schema_def: { tables?: unknown[] };   // ❌ mất type info
  relationships: unknown[];
  design_notes: string[];
  table_count: number;
  table_summaries: TableSummary[];
}

// SAU
interface GenerateResult {
  system_name: string;
  schema_def: {
    tables: BackendTable[];             // ✅ giữ đủ columns, foreign_keys, indexes
  };
  relationships: Array<{
    from_table: string;
    to_table: string;
    type: string;
    description: string;
  }>;
  design_notes: string[];
  table_count: number;
  table_summaries: TableSummary[];
}
~~~

**Bước 2** — Cập nhật interface `Props` để `onApply` nhận toàn bộ `GenerateResult`:

~~~tsx
// TRƯỚC
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (schemaDef: { tables?: unknown[] }) => void;   // ❌ thiếu system_name, relationships
}

// SAU
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: GenerateResult) => void;              // ✅ truyền đầy đủ
}
~~~

**Bước 3** — Cập nhật `handleApply` để truyền đầy đủ `result` thay vì chỉ `schema_def`:

~~~tsx
const handleApply = () => {
  if (!result) return;

  // TRƯỚC
  // onApply(result.schema_def);

  // SAU
  onApply(result);   // ✅ truyền toàn bộ result
  toast.success(`Schema "${result.system_name}" applied — ${result.table_count} tables created`);
  onClose();
  resetState();
};
~~~

---

**File:** `frontend/src/pages/user/TableEditor.tsx`

**Bước 4** — Cập nhật `handleApplyGeneratedSchema` để nhận `GenerateResult` và lấy tables từ đúng chỗ:

~~~tsx
// Import thêm type GenerateResult từ modal (hoặc export ra types riêng)
import type { GenerateResult } from '../../components/simulation/GenerateSchemaModal';

// TRƯỚC
const handleApplyGeneratedSchema = (schemaDef: { tables?: unknown[] }) => {
  const backendTables = (schemaDef.tables || []) as BackendTable[];
  // ...
};

// SAU
const handleApplyGeneratedSchema = (result: GenerateResult) => {
  const backendTables = result.schema_def?.tables || [];
  // Logic build tableIdMap, columnIdMap, fk_target giữ nguyên — chỉ cần đảm bảo
  // backendTables có đủ dữ liệu (sau Fix 1 thì sẽ đúng)
  const tableIdMap = new Map<string, string>();
  const columnIdMap = new Map<string, Map<string, string>>();

  const tablesWithIds = backendTables.map((table) => {
    const tableId = uuidv4();
    tableIdMap.set(table.name, tableId);

    const colMap = new Map<string, string>();
    const columns = table.columns.map((col) => {
      const colId = uuidv4();
      colMap.set(col.name, colId);
      return {
        id: colId,
        name: col.name,
        type: col.type,
        is_pk: col.is_pk,
        is_nullable: col.is_nullable,
        default: col.default ?? null,
      };
    });
    columnIdMap.set(table.name, colMap);

    const indexes = (table.indexes || []).map((idx) => ({
      id: uuidv4(),
      name: idx.name,
      columns: (idx.column_names || [])
        .map((colName) => colMap.get(colName))
        .filter((id): id is string => !!id),
      unique: idx.unique || false,
    }));

    return {
      id: tableId,
      name: table.name,
      columns,
      indexes,
      foreign_keys: table.foreign_keys || [],
      sample_data: [],
    };
  });

  const newSchema: SimulationSchema = {
    is_simulation: true,
    tables: tablesWithIds.map((table) => ({
      ...table,
      columns: table.columns.map((col) => {
        const fkDef = table.foreign_keys.find((fk) => fk.column === col.name);
        if (fkDef) {
          const refTableId = tableIdMap.get(fkDef.ref_table);
          const refColId = columnIdMap.get(fkDef.ref_table)?.get(fkDef.ref_column);
          if (refTableId && refColId) {
            return { ...col, fk_target: { table_id: refTableId, column_id: refColId } };
          }
        }
        return col;
      }),
    })),
  };

  setSchema(newSchema);
  setHasUnsavedChanges(true);
  setIsGenerateModalOpen(false);

  if (newSchema.tables.length > 0) {
    setSelectedTableId(newSchema.tables[0].id);
  }
};
~~~

---

## Fix 3: Giảm thời gian xử lý bằng Parallel Execution

**File:** `frontend/src/components/simulation/GenerateSchemaModal.tsx`

**Nguyên nhân:** `handleCheckAndProceed` gọi 2 API tuần tự — check xong mới generate, tổng ~60–90 giây.

~~~typescript
// HIỆN TẠI — sequential, chậm
const handleCheckAndProceed = async () => {
  const check = await workspaceService.checkSchemaClarification(description); // ~20–30s
  if (check.needs_clarification) {
    setStep('clarify');
  } else {
    await handleGenerate(false); // ~40–60s — chờ check xong mới chạy
  }
};
~~~

**Thay đổi** — chạy cả 2 calls song song bằng `Promise.all`, lưu kết quả generate trước, quyết định step sau:

~~~typescript
const handleCheckAndProceed = async () => {
  if (!description.trim() || description.trim().length < 10) {
    toast.error('Please describe your system in at least 10 characters');
    return;
  }

  setIsLoading(true);
  try {
    // ✅ Chạy song song — tổng thời gian = max(check, generate) thay vì check + generate
    const [check, generated] = await Promise.all([
      workspaceService.checkSchemaClarification(description),
      workspaceService.generateSchemaFromPrompt({ description }),
    ]);

    // Lưu kết quả generate sẵn — dùng lại nếu user skip câu hỏi
    setResult(generated);

    if (check.needs_clarification && check.questions.length > 0) {
      setQuestions(check.questions);
      setStep('clarify');
    } else {
      // Không cần hỏi thêm → preview ngay với kết quả đã có
      setStep('preview');
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.detail || 'Schema generation failed');
  } finally {
    setIsLoading(false);
  }
};
~~~

**Cập nhật `handleGenerate`** — chỉ re-call API khi user có trả lời câu hỏi mới; nếu skip thì dùng `result` đã có từ parallel call:

~~~typescript
const handleGenerate = async (withClarifications = false) => {
  setIsLoading(true);
  try {
    if (withClarifications) {
      const clarifications = questions
        .map((q, idx) => ({
          question: q.question,
          answer: (answers[idx] || []).join(', '),
        }))
        .filter((item) => item.answer.trim().length > 0);

      if (clarifications.length > 0) {
        // Re-generate với context mới từ clarification answers
        const generated = await workspaceService.generateSchemaFromPrompt({
          description,
          clarifications,
        });
        setResult(generated);
      }
      // Nếu không có answer nào → dùng result đã có từ parallel call
    }
    // withClarifications=false (Skip) → dùng result đã có, không gọi API lại

    setStep('preview');
  } catch (err: any) {
    toast.error(err?.response?.data?.detail || 'Schema generation failed');
  } finally {
    setIsLoading(false);
  }
};
~~~

> **Lưu ý:** Nếu muốn graceful fallback khi 1 trong 2 calls fail, dùng `Promise.allSettled` thay vì `Promise.all` và kiểm tra `.status` của từng result.

---

## Fix 4: Luôn hiển thị bước Clarify trước khi preview

**File:** `frontend/src/components/simulation/GenerateSchemaModal.tsx`

**Vấn đề:** Khi `needs_clarification: false` (description đủ rõ), modal nhảy thẳng vào preview, user không có cơ hội bổ sung context.

**Thay đổi trong `handleCheckAndProceed`** — khi `needs_clarification: false`, thêm 1 câu hỏi mặc định thay vì nhảy thẳng vào preview:

~~~typescript
if (check.needs_clarification && check.questions.length > 0) {
  setQuestions(check.questions);
  setStep('clarify');
} else {
  // TRƯỚC: nhảy thẳng vào preview
  // await handleGenerate(false);

  // SAU: vẫn dừng ở clarify với câu hỏi mặc định để user có thể bổ sung
  setQuestions([
    {
      question: 'Bạn có muốn thêm yêu cầu đặc biệt nào không?',
      why: 'Giúp schema phù hợp hơn với nghiệp vụ thực tế',
      options: [
        'Không, dùng schema mặc định',
        'Thêm soft delete (deleted_at)',
        'Thêm audit fields (created_by, updated_by)',
        'Tôi sẽ tự nhập thêm bên dưới',
      ],
    },
  ]);
  setStep('clarify');
}
~~~

**Cập nhật nút "Skip questions"** — không gọi API lại, dùng `result` đã có:

~~~tsx
{step === 'clarify' && (
  <>
    <button
      type="button"
      onClick={() => setStep('preview')}   // ✅ dùng result đã có từ parallel call
      disabled={isLoading}
      className="px-4 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-300"
    >
      Skip questions
    </button>
    <button
      type="button"
      onClick={() => handleGenerate(true)}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
      Generate with answers
    </button>
  </>
)}
~~~

---

## Checklist

- [ ] **Fix 1+2a** — `GenerateSchemaModal.tsx`: cập nhật `GenerateResult.schema_def.tables` từ `unknown[]` → `BackendTable[]`
- [ ] **Fix 1+2b** — `GenerateSchemaModal.tsx`: cập nhật `Props.onApply` nhận `GenerateResult` thay vì `{ tables?: unknown[] }`
- [ ] **Fix 1+2c** — `GenerateSchemaModal.tsx`: `handleApply` truyền `result` thay vì `result.schema_def`
- [ ] **Fix 1+2d** — `TableEditor.tsx`: `handleApplyGeneratedSchema` nhận `GenerateResult`, lấy tables từ `result.schema_def.tables`
- [ ] **Fix 3a** — `GenerateSchemaModal.tsx`: `handleCheckAndProceed` đổi sang `Promise.all` chạy song song
- [ ] **Fix 3b** — `GenerateSchemaModal.tsx`: `handleGenerate` chỉ re-call API khi có clarification answers mới
- [ ] **Fix 4a** — `GenerateSchemaModal.tsx`: thêm câu hỏi mặc định khi `needs_clarification: false`
- [ ] **Fix 4b** — `GenerateSchemaModal.tsx`: nút "Skip questions" đổi thành `setStep('preview')` thay vì gọi `handleGenerate(false)`
- [ ] **Test:** Nhập `"tôi muốn tạo database quản lý cửa hàng tạp hoá"` → apply → mỗi table hiện đúng số cols > 0
- [ ] **Test:** Mở Diagram view sau khi apply → có đường nối relationship giữa các bảng
- [ ] **Test:** Đo thời gian từ click "Generate Schema" đến hiện preview → dưới 30 giây
- [ ] **Test:** Nhập description dài rõ ràng (>15 từ) → vẫn hiện bước Clarify với câu hỏi mặc định
- [ ] **Test:** Ở bước Clarify, click "Skip questions" → preview ngay, không gọi thêm API