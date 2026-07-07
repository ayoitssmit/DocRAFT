import httpx

API_URL = "http://localhost:8000"

print("=" * 80)
print("DocRAFT API Connection Diagnosis")
print("=" * 80)

# 1. Test /health
print("\n[1] Testing GET /health...")
try:
    response = httpx.get(f"{API_URL}/health", timeout=5.0)
    print(f"Status Code: {response.status_code}")
    print(f"Response JSON: {response.text}")
except Exception as e:
    print(f"Failed to connect to /health: {e}")

# 2. Test /documents
print("\n[2] Testing GET /documents...")
try:
    response = httpx.get(f"{API_URL}/documents", timeout=5.0)
    print(f"Status Code: {response.status_code}")
    print(f"Response JSON: {response.text}")
except Exception as e:
    print(f"Failed to connect to /documents: {e}")

# 3. Test dummy Agent Chat with invalid query to trigger 500 traceback if any
print("\n[3] Testing POST /agent/chat (empty query to inspect traceback)...")
try:
    response = httpx.post(f"{API_URL}/agent/chat", json={"query": "", "messages": []}, timeout=5.0)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Failed to connect to /agent/chat: {e}")

print("\n" + "=" * 80)
