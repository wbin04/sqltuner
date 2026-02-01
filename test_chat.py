#!/usr/bin/env python3
"""
Test chat completion API to measure performance
"""
import asyncio
import httpx
import time

async def main():
    # Login
    login_url = "http://localhost:8000/api/v1/auth/login"
    login_data = {
        "email": "quochuy04.ar@gmail.com",
        "password": "quochuy123"
    }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        print("Logging in...")
        response = await client.post(login_url, json=login_data)
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Logged in")
        
        # List connections
        response = await client.get("http://localhost:8000/api/v1/connections/", headers=headers)
        connections = response.json()
        
        # Find fastfood_db
        fastfood_conn = next((c for c in connections if c['name'] == 'fastfood_db'), None)
        if not fastfood_conn:
            print("❌ fastfood_db not found")
            return
        
        connection_id = fastfood_conn["id"]
        print(f"✓ Using connection: {fastfood_conn['name']} (ID: {connection_id})")
        
        print(f"\n{'='*70}")
        print(f"CHAT COMPLETION TEST")
        print(f"{'='*70}")
        
        # Chat request
        chat_url = "http://localhost:8000/api/v1/chat/completion"
        chat_data = {
            "connection_id": connection_id,
            "message": "SELECT * FROM users WHERE email like 'user"
        }
        
        print(f"\nMessage: {chat_data['message']}")
        print("\nCalling /api/v1/chat/completion...")
        
        start_time = time.time()
        response = await client.post(chat_url, json=chat_data, headers=headers)
        end_time = time.time()
        
        if response.status_code != 200:
            print(f"\n❌ Request failed: {response.status_code}")
            print(response.text)
            return
        
        result = response.json()
        
        print(f"\nTotal API time: {end_time - start_time:.2f}s")
        print(f"\n{'='*70}")
        print("RESULT")
        print(f"{'='*70}")
        print(f"\nConversation ID: {result['conversation_id']}")
        print(f"\nResponse:\n{result['content'][:300]}...")
        if result.get('sql_generated'):
            print(f"\nGenerated SQL:\n{result['sql_generated']}")

if __name__ == "__main__":
    asyncio.run(main())
