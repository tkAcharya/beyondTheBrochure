from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("Starting verification test...")
response = client.post("/analyze", json={"destination": "Goa"})

if response.status_code == 200:
    data = response.json()
    print("\n[SUCCESS] API Verified Successfully!")
    print("\n--- Model Output Keys ---")
    for k in data.keys():
        print(f" - {k}")

    print("\n--- Sample Verdict Output ---")
    print(data.get("blunt_summary_verdict", "Missing verdict"))
    
    # Asserting exactly the fields we need exist
    expected_keys = ["hidden_truths", "monsoon_risks", "realistic_budget_breakdowns", "off_radar_tips", "blunt_summary_verdict"]
    missing = [k for k in expected_keys if k not in data]
    if missing:
        print(f"[FAILED] Verification Failed. Missing keys: {missing}")
    else:
        print("\n[SUCCESS] JSON Structure matches exactly what the Chrome extension expects.")
else:
    print(f"[FAILED] Test failed with {response.status_code}: {response.text}")
