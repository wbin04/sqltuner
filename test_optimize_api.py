#!/usr/bin/env python3
"""
Test optimize API endpoint directly (simulates frontend request)
"""
import asyncio
import httpx
import time

async def main():
    # Login first
    login_url = "http://localhost:8000/api/v1/auth/login"
    login_data = {
        "email": "quochuy04.ar@gmail.com",
        "password": "quochuy123"
    }
    
    async with httpx.AsyncClient() as client:
        # Login
        print("Logging in...")
        response = await client.post(login_url, json=login_data)
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return
        
        token = response.json()["access_token"]
        print(f"✓ Logged in successfully")
        
        # List connections first
        connections_url = "http://localhost:8000/api/v1/connections/"
        response = await client.get(connections_url, headers={"Authorization": f"Bearer {token}"})
        connections = response.json()
        if not connections:
            print("No connections found")
            return
        
        # Find fastfood_db
        fastfood_conn = next((c for c in connections if c['name'] == 'fastfood_db'), None)
        if not fastfood_conn:
            print("❌ fastfood_db not found, using first connection")
            connection_id = connections[0]["id"]
            conn_name = connections[0]['name']
        else:
            connection_id = fastfood_conn["id"]
            conn_name = fastfood_conn['name']
        
        print(f"✓ Using connection: {conn_name} (ID: {connection_id})")
        
        # Optimize request
        optimize_url = "http://localhost:8000/api/v1/sql/optimize"
        headers = {"Authorization": f"Bearer {token}"}
        
        optimize_data = {
            "connection_id": connection_id,
            "sql_query": "SELECT * FROM cart WHERE id > 100",  # Query khác để không bị cache
            "include_explain": False
        }
        
        print("\n" + "=" * 70)
        print("OPTIMIZE API TEST (via HTTP - like frontend)")
        print("=" * 70)
        print(f"Query: {optimize_data['sql_query']}")
        print("\nCalling /api/v1/sql/optimize...")
        
        start_time = time.time()
        response = await client.post(optimize_url, json=optimize_data, headers=headers, timeout=120.0)
        end_time = time.time()
        
        if response.status_code != 200:
            print(f"\n❌ Request failed: {response.status_code}")
            print(response.text)
            return
        
        result = response.json()
        
        print(f"\nTotal API time: {end_time - start_time:.2f}s")
        print("\n" + "=" * 70)
        print("RESULT")
        print("=" * 70)
        print(f"\nOptimized SQL:\n  {result['optimized_sql']}")
        print(f"\nIndex Recommendation:\n  {result.get('index_recommendation') or 'None'}")
        print(f"\nExplanation:\n  {result['explanation'][:200]}...")


if __name__ == "__main__":
    asyncio.run(main())
