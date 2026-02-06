# ROLE
You are a Senior Backend Engineer.
The user is facing an issue with the `MockDataService`: **"Orphan Records"**.
If a user generates data for a Child Table (e.g., `orders`) *before* the Parent Table (e.g., `users`) is populated, the Foreign Keys are generated randomly, breaking join integrity.

# GOAL
Upgrade `MockDataService.generate` to implement **Recursive Generation**.
**Logic:** If a referenced Parent Table is empty, automatically generate a small batch of data for the Parent Table first, then proceed with the Child Table.

# REQUIREMENTS

## 1. Logic Update: Recursive Populating
Modify the `generate` method to check parent table data availability.

-   **Step 1:** Identify FK columns.
-   **Step 2:** Check the Parent Table in `schema_json`.
-   **Step 3:** If Parent Table `sample_data` is empty:
    -   **ACTION:** Recursively call `MockDataService.generate(parent_table, ...)` to create 10-20 sample rows for the parent.
    -   **UPDATE:** Append these new rows to the Parent Table's `sample_data` in the `schema_json` object (in-memory update) so they are available for the current generation process.
-   **Step 4:** Proceed to pick a random ID from the now-populated Parent Table.

## 2. Safety Mechanism: Recursion Depth
Add a `recursion_depth` parameter to prevent infinite loops (e.g., Table A -> Table B -> Table A). Stop recursion if depth > 3.

## 3. Implementation (`MockDataService.py`)

```python
import random
from typing import List, Dict, Any, Optional
from faker import Faker

fake = Faker()

class MockDataService:
    
    # ... (Keep NAME_PATTERNS and TYPE_MAPPERS) ...

    @staticmethod
    def generate(
        table_name: str, 
        schema_json: Dict[str, Any], 
        count: int,
        recursion_depth: int = 0
    ) -> List[Dict[str, Any]]:
        
        # 0. Safety Check
        if recursion_depth > 3:
            print(f"⚠️ Max recursion depth reached for {table_name}. Skipping FK auto-generation.")
            return []

        # 1. Find Target Table
        target_table = next((t for t in schema_json['tables'] if t['name'] == table_name), None)
        if not target_table:
            raise ValueError(f"Table {table_name} not found")

        columns = target_table.get('columns', [])
        foreign_keys = target_table.get('foreign_keys', [])

        # --- STEP 1: PREPARE FK POOLS (With Recursive Auto-Gen) ---
        fk_pools = {}
        
        for fk in foreign_keys:
            col_name = fk['column']
            ref_table_name = fk['ref_table']
            ref_col_name = fk['ref_column']

            parent_table = next((t for t in schema_json['tables'] if t['name'] == ref_table_name), None)
            
            if parent_table:
                # CHECK: Is Parent Empty?
                existing_data = parent_table.get('sample_data', [])
                
                if not existing_data:
                    # >>> RECURSIVE MAGIC HAPPENS HERE <<<
                    print(f"🔄 Auto-generating parent data for '{ref_table_name}' (required by '{table_name}')...")
                    
                    # Generate a small batch (e.g., 10 rows) for the parent
                    parent_rows = MockDataService.generate(
                        table_name=ref_table_name,
                        schema_json=schema_json, # Pass the SAME schema object
                        count=10, # Small batch for dependencies
                        recursion_depth=recursion_depth + 1
                    )
                    
                    # IMPORTANT: Update the in-memory schema so other cols can use it
                    if 'sample_data' not in parent_table:
                        parent_table['sample_data'] = []
                    parent_table['sample_data'].extend(parent_rows)
                    parent_table['row_count'] = len(parent_table['sample_data'])
                    
                    existing_data = parent_table['sample_data']

                # Now extract the IDs
                valid_values = [
                    row.get(ref_col_name) 
                    for row in existing_data 
                    if row.get(ref_col_name) is not None
                ]
                fk_pools[col_name] = valid_values

        # --- STEP 2: GENERATE ROWS (Standard) ---
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                
                if col_name in fk_pools:
                    options = fk_pools[col_name]
                    if options:
                        row[col_name] = random.choice(options)
                    else:
                        row[col_name] = MockDataService._get_value(col_name, col_type)
                
                # ... (PK and Standard logic) ...
                elif col.get('is_pk') and 'UUID' in col_type.upper():
                    row[col_name] = fake.uuid4()
                else:
                    row[col_name] = MockDataService._get_value(col_name, col_type)
            
            results.append(row)

        return results
```

## 4. API Response Consideration
Since the service might modify *other* tables (the parents), the API needs to return the **Entire Updated Schema** (or at least indicate which tables were updated), not just the rows for the requested table.

**Update the API Endpoint Logic:**
1. Call `MockDataService.generate`.
2. Since `schema_json` is passed by reference (in Python dicts), `parent_table['sample_data']` is updated in place inside the service.
3. Save the **entire** updated `schema_json` back to the database (`metadata_cache`).
4. Return the full updated schema to the Frontend so the UI refreshes *both* the Child and Parent table data.

# DELIVERABLES
1.  Updated `MockDataService` with recursion logic.
2.  Updated API endpoint to save and return the full schema modification.