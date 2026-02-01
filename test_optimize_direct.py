#!/usr/bin/env python3
"""
Direct test of optimize_sql to see LLM response
"""
import asyncio
import json
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services.llm_service import llm_service


async def main():
    # Real schema from your database
    db_schema = {
        "tables": [
            {
                "name": "users",
                "columns": [
                    {"name": "id", "data_type": "INTEGER", "primary_key": True},
                    {"name": "email", "data_type": "VARCHAR"},
                    {"name": "password", "data_type": "VARCHAR"},
                    {"name": "role", "data_type": "VARCHAR"},
                    {"name": "created_at", "data_type": "TIMESTAMP"}
                ],
                "indexes": [
                    {"name": "users_pkey", "columns": ["id"], "unique": True}
                ]
            },
            {
                "name": "cart",
                "columns": [
                    {"name": "id", "data_type": "INTEGER"},
                    {"name": "user_id", "data_type": "INTEGER"},
                    {"name": "total", "data_type": "DECIMAL"}
                ]
            }
        ]
    }
    
    schema_json = json.dumps(db_schema)
    test_sql = "SELECT * FROM users WHERE email = 'kfc@gmail.com'"
    
    print("=" * 70)
    print("DIRECT OPTIMIZATION TEST")
    print("=" * 70)
    print(f"\nQuery: {test_sql}")
    print(f"Schema includes: users (with indexes on id), cart")
    print("\nCalling llm_service.optimize_sql()...\n")
    
    start_time = time.time()
    result = await llm_service.optimize_sql(test_sql, schema_json)
    end_time = time.time()
    
    print(f"Time = {end_time - start_time}")
    
    print("\n" + "=" * 70)
    print("RESULT")
    print("=" * 70)
    print(f"\nOptimized SQL:\n  {result['optimized_sql']}")
    print(f"\nIndex Suggestion:\n  {result.get('index_suggestion') or 'None'}")
    print(f"\nExplanation:\n  {result['explanation'][:200]}...")
    print(f"\nReasoning:\n  {result.get('reasoning', 'N/A')}")
    
    # Validation
    if result.get('index_suggestion'):
        if 'cart' in result['index_suggestion'].lower():
            print("\n❌ HALLUCINATION: Suggested cart table!")
        elif 'users' in result['index_suggestion'].lower():
            print("\n✅ CORRECT: Suggested users table index")
    else:
        print("\n⚠️  NO INDEX SUGGESTED")


if __name__ == "__main__":
    asyncio.run(main())
