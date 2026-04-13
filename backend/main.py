from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import scraper
from google import genai
from google.genai import types
from fastapi.responses import StreamingResponse
import json

load_dotenv()

app = FastAPI()

# Add CORS so our Chrome extension can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, usually restrict this in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite") # load from env

if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
    print("WARNING: GEMINI_API_KEY not configured in .env")

# Initialize GenAI Client
client = genai.Client(api_key=GEMINI_API_KEY)

class AnalyzeRequest(BaseModel):
    destination: str

@app.post("/analyze")
def analyze_destination(req: AnalyzeRequest):
    def event_generator():
        if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
            yield json.dumps({"error": "Gemini API Key is not configured correctly on the backend."}) + "\n"
            return
            
        print(f"Gathering intel for: {req.destination}")
        
        # 1. Scrape the data and yield progress
        scrape_gen = scraper.gather_destination_data_stream(req.destination)
        
        final_scrape_data = None
        for chunk in scrape_gen:
            if chunk["type"] == "progress":
                yield json.dumps(chunk) + "\n"
            elif chunk["type"] == "complete":
                final_scrape_data = chunk
                yield json.dumps({"type": "progress", "percent": 90, "message": chunk["message"]}) + "\n"

        context_data = final_scrape_data["context"] if final_scrape_data else ""
        if not context_data.strip():
            context_data = f"No recent scraped context available. Rely on your vast internal knowledge to review {req.destination}."

        # 2. Build the LLM Prompt
        system_instruction = """
        You are a brutally honest, unfiltered travel analyst. Your job is to cut through tourist-trap PR and deliver the absolute truth about a destination.
        You will be given raw, scraped internet context (from Reddit, TripAdvisor, etc.). 
        Synthesize this context and formulate a structured JSON response. Do NOT use markdown code blocks like ```json around the response, return purely valid JSON.
        """
        
        prompt = f"""
        Destination: {req.destination}
        Scraped Context:
        {context_data}
        
        Based on the destination, return a JSON object with EXACTLY these keys:
        {{
            "hidden_truths": "Paragraph detailing scams, tourist traps, and things locals won't tell you.",
            "monsoon_risks": "Paragraph about the worst times to visit considering weather and crowds.",
            "realistic_budget_breakdowns": "Realistic daily budget for a moderate traveler, ignoring budget-blogger lies.",
            "off_radar_tips": "2-3 highly specific, non-cliche things to do instead of main attractions.",
            "blunt_summary_verdict": "A 1-2 sentence final rating/verdict (e.g., 'Worth the hype but severely overpriced, skip the central square.').",
            "smiley": "A single emoji representing the final verdict (e.g., 🤡, 😍, 💸).",
            "user_sentiments": "A brief analysis of the general sentiment of real users online.",
            "staycation_recommendations": "1-2 local staycation or nearby getaway spots often overlooked."
        }}
        """
        
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7,
                    response_mime_type="application/json",
                )
            )
            
            raw_text = response.text.strip()
            start_idx = raw_text.find('{')
            end_idx = raw_text.rfind('}')
            if start_idx != -1 and end_idx != -1:
                raw_text = raw_text[start_idx:end_idx+1]
            
            result = json.loads(raw_text)
            
            yield json.dumps({
                "type": "complete",
                "result": result,
                "references": final_scrape_data.get("references", []) if final_scrape_data else []
            }) + "\n"
        except Exception as e:
            print(f"Error calling Gemini: {e}")
            yield json.dumps({"error": "Failed to synthesize report from Gemini."}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

class RateReferenceRequest(BaseModel):
    reference_url: str
    reference_text: str

@app.post("/rate-reference")
def rate_reference(req: RateReferenceRequest):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
         raise HTTPException(status_code=500, detail="Gemini API Key is not configured correctly on the backend.")

    prompt = f"""
    You are an objective travel content rater.
    Here is a scraped snippet from a travel source:
    URL: {req.reference_url}
    Content Snippet: {req.reference_text}
    
    Rate the reliability of this travel reference based on its content. Is it a generic tourist trap promotion or genuine advice?
    Return a JSON object with two keys:
    - "rating": "A string like '7/10'",
    - "reason": "A 1-2 sentence reason for this rating."
    Response must be purely valid JSON.
    """
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.5,
                response_mime_type="application/json",
            )
        )
        # Parse JSON
        raw_text = response.text.strip()
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            raw_text = raw_text[start_idx:end_idx+1]
        
        return json.loads(raw_text)
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        raise HTTPException(status_code=500, detail="Failed to rate reference.")
