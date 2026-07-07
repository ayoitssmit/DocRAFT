from ollama import Client as OllamaClient

hosts = ["http://localhost:11434", "http://127.0.0.1:11434", "http://[::1]:11434"]

print("=" * 80)
print("DocRAFT Loopback Address Connection Diagnostic")
print("=" * 80)

for host in hosts:
    print(f"\nTesting connection to: {host} ...")
    try:
        client = OllamaClient(host=host)
        models = client.list().get("models", [])
        print(f"  [✓] SUCCESS! Connection established. Found {len(models)} models:")
        for m in models[:3]:
            print(f"      - {m.get('model')}")
        if len(models) > 3:
            print("      - ...")
    except Exception as e:
        print(f"  [x] FAILED: {e}")

print("\n" + "=" * 80)
