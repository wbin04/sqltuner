# ROLE
You are a Senior Full-Stack Engineer (Python/FastAPI + React).
The user wants to implement a **"Smart Mock Data Generator"** for the Simulation Workspace.
**GOAL:** Allow users to instantly generate 100-1000 rows of realistic sample data for a selected table using the `Faker` library.

# TECH STACK
- **Backend:** Python, FastAPI, `Faker` library.
- **Frontend:** React, Tailwind CSS (inside the existing `TableEditor.tsx`).

# REQUIREMENTS

## 1. Backend Implementation

### A. Install Dependencies
Assume `pip install faker` is run.

### B. Create Service: `MockDataService`
Create a service that maps Column Definitions to Faker providers based on a "Smart Heuristic" strategy.

**Logic Priority:**
1.  **Name-based Matching:** Check column name (case-insensitive).
    - `email` -> `faker.email()`
    - `name`, `fullname`, `user` -> `faker.name()`
    - `phone`, `mobile` -> `faker.phone_number()`
    - `address`, `city`, `country` -> `faker.address()`, etc.
    - `created_at`, `updated_at` -> `faker.date_time_this_year()`
2.  **Type-based Matching:** If name doesn't match, check `type`.
    - `UUID` -> `str(uuid.uuid4())`
    - `INTEGER` -> `faker.random_int(min=1, max=1000)`
    - `BOOLEAN` -> `faker.boolean()`
    - `TIMESTAMP`, `DATE` -> `faker.iso8601()`
    - `VARCHAR`, `TEXT` -> `faker.text(max_nb_chars=20)`

### C. API Endpoint
Create `POST /api/v1/simulation/generate-data`.

**Request Body:**
```json
{
  "count": 100,
  "columns": [
    { "name": "id", "type": "UUID", "is_pk": true },
    { "name": "email", "type": "VARCHAR" },
    { "name": "age", "type": "INTEGER" }
  ]
}
```

**Response:**
```json
[
  { "id": "uuid-...", "email": "bob@example.com", "age": 25 },
  ...
]
```

---

## 2. Frontend Implementation (`TableEditor.tsx`)

### A. UI Update (Tab: Sample Data)
In the "Sample Data" tab, add a Toolbar above the grid.
- **Button:** `[Generate Data]` (Use `Sparkles` icon from lucide-react).
- **Popover/Modal:** When clicked, show a small popup:
  - Input: "Number of rows" (Default: 50, Max: 1000).
  - Button: "Generate".

### B. Integration Logic
1.  When "Generate" is clicked, call the API with the current table's columns and the requested count.
2.  **State Update:**
    - Receive the array of rows from API.
    - **Append** (or Replace) these rows to the existing `table.sample_data` in the local `meta_schema` state.
    - Update `table.row_count`.
    - Show a success toast.

# CODE STRUCTURE EXAMPLES

## Backend (Service)
```python
from faker import Faker
fake = Faker()

class MockDataService:
    @staticmethod
    def generate(columns: list, count: int) -> list:
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                row[col.name] = MockDataService._get_value(col.name, col.type)
            results.append(row)
        return results

    @staticmethod
    def _get_value(name: str, dtype: str):
        name = name.lower()
        if 'email' in name: return fake.email()
        if 'name' in name: return fake.name()
        # ... logic for types ...
        return fake.word()
```

## Frontend (Component)
```tsx
// Inside SampleDataTab component
const handleGenerate = async (count: number) => {
  setIsLoading(true);
  try {
    const newRows = await api.generateMockData({ columns: table.columns, count });
    // Update local state (Immer or standard state)
    updateTableData(table.name, (draft) => {
       draft.sample_data.push(...newRows);
       draft.row_count += newRows.length;
    });
  } finally {
    setIsLoading(false);
  }
};
```

# DELIVERABLES
1.  Full code for `backend/app/services/mock_data_service.py`.
2.  Updated API router code.
3.  Updated `TableEditor.tsx` (or `SampleDataTab.tsx`) with the UI and API integration.