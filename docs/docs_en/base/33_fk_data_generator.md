# ROLE
You are a Senior Backend Engineer (Python/FastAPI).
The user wants to implement a **"Smart Mock Data Generator"** service for a database simulation tool.

# GOAL
Implement `MockDataService` that generates realistic sample data for a given table.
**CRITICAL REQUIREMENT:** The generator must respect **Foreign Key Integrity** and use **Smart Heuristics** to guess data types based on column names.

# REQUIREMENTS

## 1. Logic Strategy (The 3-Layer Fallback)

When generating a value for a specific column, apply this priority order:

1.  **Priority 1: Foreign Key Lookup (Referential Integrity)**
    - Check if the column is a Foreign Key.
    - If YES: Look up the Parent Table in the `meta_schema`.
    - Collect all existing IDs from the Parent Table's `sample_data`.
    - Pick a random value using `random.choice()`.
    - *Fallback:* If the Parent Table has no data, return `None` (if nullable) or a random value (with a logged warning).

2.  **Priority 2: Semantic Name Matching (Regex)**
    - If NOT an FK, check the column **Name** against regex patterns.
    - Examples: `email` -> `faker.email()`, `phone` -> `faker.phone_number()`, `created_at` -> `faker.iso8601()`.

3.  **Priority 3: Data Type Fallback**
    - If name doesn't match, generate based on **SQL Type**.
    - Parse `VARCHAR(n)` to ensure the generated string length < `n`.
    - Map `UUID` -> `uuid4`, `INTEGER` -> `random_int`, `BOOLEAN` -> `bool`.

## 2. Implementation Details (`MockDataService.py`)

Refactor or create the service with the following structure:

```python
import random
import re
from typing import List, Dict, Any, Optional
from faker import Faker

fake = Faker()

class MockDataService:
    
    # --- REGEX PATTERNS FOR SEMANTIC MATCHING ---
    NAME_PATTERNS = {
        r'email': fake.email,
        r'(full)?name': fake.name,
        r'first_?name': fake.first_name,
        r'last_?name': fake.last_name,
        r'phone|mobile': fake.phone_number,
        r'address': fake.address,
        r'city': fake.city,
        r'country': fake.country,
        r'company': fake.company,
        r'job|title': fake.job,
        r'date|time|created|updated': fake.date_time_this_year,
        r'status': lambda: random.choice(['active', 'inactive', 'pending', 'draft']),
        r'price|cost|amount': lambda: round(random.uniform(10, 1000), 2),
        r'qty|quantity|count': lambda: random.randint(1, 100),
        r'avatar|image|photo': fake.image_url,
    }

    # --- TYPE MAPPERS FOR FALLBACK ---
    TYPE_MAPPERS = {
        'UUID': fake.uuid4,
        'INTEGER': lambda: random.randint(1, 1000),
        'INT': lambda: random.randint(1, 1000),
        'BOOLEAN': fake.boolean,
        'BOOL': fake.boolean,
        'FLOAT': lambda: round(random.uniform(0, 1000), 2),
        'DECIMAL': lambda: round(random.uniform(0, 1000), 2),
        'TIMESTAMP': lambda: fake.iso8601(),
        'DATE': lambda: fake.date_this_decade().isoformat(),
        'JSON': lambda: fake.json(),
        'JSONB': lambda: fake.json(),
    }

    @staticmethod
    def generate(table_name: str, schema_json: Dict[str, Any], count: int) -> List[Dict[str, Any]]:
        """
        Main entry point to generate rows.
        """
        # 1. Find the target table
        target_table = next((t for t in schema_json['tables'] if t['name'] == table_name), None)
        if not target_table:
            raise ValueError(f"Table {table_name} not found in schema")

        columns = target_table.get('columns', [])
        foreign_keys = target_table.get('foreign_keys', [])

        # 2. Pre-calculate FK Value Pools (Optimization)
        # Dictionary mapping: col_name -> list of valid parent IDs
        fk_pools = {}
        
        for fk in foreign_keys:
            col_name = fk['column']
            ref_table_name = fk['ref_table']
            ref_col_name = fk['ref_column']

            # Find parent table
            parent_table = next((t for t in schema_json['tables'] if t['name'] == ref_table_name), None)
            
            valid_values = []
            if parent_table and 'sample_data' in parent_table:
                # Extract valid IDs
                valid_values = [
                    row.get(ref_col_name) 
                    for row in parent_table['sample_data'] 
                    if row.get(ref_col_name) is not None
                ]
            
            fk_pools[col_name] = valid_values

        # 3. Generate Rows
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                
                # --- CHECK 1: FOREIGN KEY ---
                if col_name in fk_pools:
                    options = fk_pools[col_name]
                    if options:
                        row[col_name] = random.choice(options)
                    else:
                        # Graceful degradation: Parent table empty -> Generate random or None
                        row[col_name] = MockDataService._get_value(col_name, col_type)
                
                # --- CHECK 2: PRIMARY KEY (UUID) ---
                elif col.get('is_pk') and 'UUID' in col_type.upper():
                    row[col_name] = fake.uuid4()
                
                # --- CHECK 3: SMART VALUE ---
                else:
                    row[col_name] = MockDataService._get_value(col_name, col_type)
            
            results.append(row)

        return results

    @staticmethod
    def _get_value(col_name: str, col_type: str):
        """
        Decides value based on Name (Regex) or Type (Fallback)
        """
        col_name_lower = col_name.lower()
        base_type, length = MockDataService._parse_sql_type(col_type)

        # A. Semantic Match
        for pattern, provider in MockDataService.NAME_PATTERNS.items():
            if re.search(pattern, col_name_lower):
                val = provider()
                # Truncate string if too long for VARCHAR(n)
                if isinstance(val, str) and length and len(val) > length:
                    return val[:length]
                return val

        # B. Type Match
        # Handle VARCHAR/CHAR length constraints
        if base_type in ['VARCHAR', 'CHAR', 'STRING', 'TEXT']:
            max_len = length if length else 50
            # If very short (e.g., code), generate random letters
            if max_len < 15:
                return fake.lexify('?' * max_len)
            return fake.text(max_nb_chars=min(max_len, 200))

        # Handle other types
        if base_type in MockDataService.TYPE_MAPPERS:
            return MockDataService.TYPE_MAPPERS[base_type]()

        return None

    @staticmethod
    def _parse_sql_type(raw_type: str):
        """
        Extracts base type and length. 
        Ex: "VARCHAR(255)" -> ("VARCHAR", 255)
        """
        raw_type = raw_type.upper().strip()
        match = re.match(r'^([A-Z]+)(?:\((\d+)\))?$', raw_type)
        if match:
            base = match.group(1)
            length = int(match.group(2)) if match.group(2) else None
            return base, length
        return raw_type, None
```

## 3. Integration Point (`/api/v1/simulation.py`)

Update the endpoint to pass the **entire `meta_schema`** to the service, not just the column list, so the service can perform FK lookups.

```python
@router.post("/generate-data")
async def generate_mock_data(
    request: GenerateDataRequest, # { table_name: str, count: int }
    # ... dependencies ...
):
    # ... load connection ...
    
    new_rows = MockDataService.generate(
        table_name=request.table_name,
        schema_json=connection.metadata_cache, # Pass full schema
        count=request.count
    )
    
    # ... logic to append new_rows to connection.metadata_cache ...
    # ... save to DB ...
    
    return {"status": "success", "rows": new_rows}
```

# DELIVERABLES
1.  Complete `MockDataService` class with the logic above.
2.  Updated API endpoint handling the full schema context.