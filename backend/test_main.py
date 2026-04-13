from fastapi.testclient import TestClient
import pytest
from main import app

client = TestClient(app)

def test_analyze_endpoint():
    # We will test the happy path for the analyze endpoint.
    # Note: This will hit the real scraper and the real Gemini API.
    payload = {
        "destination": "Goa"
    }
    response = client.post("/analyze", json=payload)
    
    # Verify the status code
    assert response.status_code == 200, f"Expected 200, got {response.status_code} with body: {response.text}"
    
    data = response.json()
    
    # Verify the structured JSON response matches our exact required keys
    assert "hidden_truths" in data, "Missing 'hidden_truths'"
    assert "monsoon_risks" in data, "Missing 'monsoon_risks'"
    assert "realistic_budget_breakdowns" in data, "Missing 'realistic_budget_breakdowns'"
    assert "off_radar_tips" in data, "Missing 'off_radar_tips'"
    assert "blunt_summary_verdict" in data, "Missing 'blunt_summary_verdict'"
    
    # Quick sanity check on the content
    assert isinstance(data["hidden_truths"], str)
    assert len(data["blunt_summary_verdict"]) > 0
    
    print("\n--- Test Response from Gemini 3.1 Flash Lite ---")
    print(f"Verdict: {data['blunt_summary_verdict']}")
