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
import time
import random

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
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
FALLBACK_MODEL = "gemini-2.5-flash"

if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
    print("WARNING: GEMINI_API_KEY not configured in .env")

# Initialize GenAI Client
client = genai.Client(api_key=GEMINI_API_KEY)

def call_gemini_with_retry(prompt, system_instruction=None, temperature=0.7, mime_type="application/json"):
    """Calls Gemini with exponential backoff and fallback model support."""
    models_to_try = [GEMINI_MODEL, FALLBACK_MODEL]
    max_retries = 3
    
    for model_name in models_to_try:
        for attempt in range(max_retries):
            try:
                print(f"Calling Gemini ({model_name}) - Attempt {attempt + 1}")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=temperature,
                        response_mime_type=mime_type,
                    )
                )
                return response
            except Exception as e:
                err_str = str(e).upper()
                if "503" in err_str or "UNAVAILABLE" in err_str or "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    wait_time = (2 ** attempt) + random.random()
                    print(f"Gemini {model_name} busy/overloaded (Error: {e}). Retrying in {wait_time:.2f}s...")
                    time.sleep(wait_time)
                else:
                    # For other errors (like auth or bad request), don't retry same model
                    print(f"Gemini error with {model_name}: {e}")
                    break 
        print(f"Model {model_name} failed after all retries. Trying next model if available...")
    
    raise Exception("All Gemini models failed or are unavailable.")

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
            elif chunk["type"] == "reference_found":
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
            "budget_grid": {{
                "hostel": "Number representing typical daily spend in USD",
                "hotel": "Number representing typical daily spend in USD",
                "food": "Number representing typical daily spend in USD",
                "transit": "Number representing typical daily spend in USD"
            }},
            "off_radar_tips": "2-3 highly specific, non-cliche things to do instead of main attractions.",
            "blunt_summary_verdict": "A 1-2 sentence final rating/verdict.",
            "smiley": "A single emoji representing the final verdict.",
            "score": "A numeric rating out of 100 for the destination.",
            "user_sentiments": "A brief analysis of the general sentiment.",
            "sentiment_bars": {{
                "love": "Percentage 0-100 indicating how many left positive reviews",
                "expensive": "Percentage 0-100 indicating how many found it overpriced",
                "crowded": "Percentage 0-100 indicating how many found it overcrowded",
                "return_trip": "Percentage 0-100 indicating how many want to return"
            }},
            "best_time_heatmap": [
                {{"month": "Jan", "score": 90}},
                {{"month": "Feb", "score": 80}},
                {{"month": "Mar", "score": 70}},
                {{"month": "Apr", "score": 60}},
                {{"month": "May", "score": 50}},
                {{"month": "Jun", "score": 40}},
                {{"month": "Jul", "score": 30}},
                {{"month": "Aug", "score": 40}},
                {{"month": "Sep", "score": 60}},
                {{"month": "Oct", "score": 80}},
                {{"month": "Nov", "score": 90}},
                {{"month": "Dec", "score": 100}}
            ],
            "staycation_recommendations": "1-2 local staycation spots."
        }}
        Note for best_time_heatmap: adjust the scores for each month 0-100 (where 100 is best time to go, taking into account weather and lack of massive crowds).
        """
        
        try:
            response = call_gemini_with_retry(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.7,
                mime_type="application/json"
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

# ─── /itinerary ────────────────────────────────────────────────────────────────

class ItineraryRequest(BaseModel):
    destination: str
    days: int = 5
    travel_style: str = "moderate"   # budget | moderate | luxury
    travelers: str = "solo"          # solo | couple | family | group
    focus: str = "mixed"             # culture | food | nature | mixed
    analysis_context: str = ""       # optionally pass the prior /analyze result summary

@app.post("/itinerary")
def generate_itinerary(req: ItineraryRequest):
    """
    Uses Gemini to generate a detailed, honest day-by-day travel itinerary
    informed by the analysis context (hidden truths, budget, off-radar tips).
    Returns a JSON array of days, each with a list of timed activities.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured correctly on the backend.")

    system_instruction = """
    You are a brutally honest travel planner. You avoid clichés, tourist traps, and overpriced
    mainstream experiences. Your itineraries are practical, locally-informed, and time-realistic.
    You always include honest notes about what to watch out for. You never suggest experiences
    that are primarily monetised tourist traps unless there is no alternative.
    Return purely valid JSON — no markdown, no code fences.
    """

    prompt = f"""
    Create a {req.days}-day travel itinerary for: {req.destination}
    Travel style: {req.travel_style}
    Traveler type: {req.travelers}
    Focus: {req.focus}

    Context from prior analysis (use this to avoid tourist traps and incorporate honest tips):
    {req.analysis_context if req.analysis_context else "Use your knowledge of common traveler complaints and local insights."}

    Return a JSON object with this exact structure:
    {{
        "destination": "{req.destination}",
        "duration_days": {req.days},
        "travel_style": "{req.travel_style}",
        "headline_tip": "One brutally honest overarching tip for this trip.",
        "days": [
            {{
                "day": 1,
                "theme": "Short evocative theme for the day (e.g. 'Arrival & Real Neighbourhood Dive')",
                "areas": "Comma-separated neighbourhood/area names for the day",
                "activities": [
                    {{
                        "time": "HH:MM AM/PM",
                        "name": "Activity name",
                        "note": "1-2 sentence honest note — include cost, avoid-if, local alternative",
                        "tag": "One of: Food | Culture | Insider | Logistics | Nature | Shopping"
                    }}
                ]
            }}
        ],
        "budget_summary": {{
            "daily_estimate": "Realistic daily spend for {req.travel_style} style in local currency",
            "biggest_trap": "The single biggest money trap tourists fall into here",
            "money_saving_tip": "One concrete money-saving tip"
        }},
        "partner_links": {{
            "flights": "https://www.skyscanner.com/flights-to/{req.destination.replace(' ','-').lower()}/",
            "hotels": "https://www.booking.com/searchresults.en.html?ss={req.destination.replace(' ','+')}",
            "activities": "https://www.getyourguide.com/{req.destination.replace(' ','-').lower()}-l193/"
        }}
    }}
    """

    try:
        response = call_gemini_with_retry(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.75,
            mime_type="application/json"
        )
        raw_text = response.text.strip()
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            raw_text = raw_text[start_idx:end_idx+1]
        return json.loads(raw_text)
    except Exception as e:
        print(f"Error calling Gemini for itinerary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate itinerary from Gemini.")


# ─── /partner-links ─────────────────────────────────────────────────────────────

class PartnerLinksRequest(BaseModel):
    destination: str

@app.get("/partner-links")
def get_partner_links(destination: str):
    """
    Returns pre-built deep-link URLs for partner booking sites for a given destination.
    No AI call needed — pure URL generation.
    """
    dest_encoded = destination.replace(' ', '+')
    dest_slug    = destination.replace(' ', '-').lower()
    dest_iata    = destination[:3].upper()  # rough approximation; real version would use an airport lookup

    return {
        "destination": destination,
        "flights": {
            "skyscanner": f"https://www.skyscanner.com/flights-to/{dest_slug}/",
            "google_flights": f"https://www.google.com/travel/flights?dest={dest_encoded}",
        },
        "accommodation": {
            "booking_com": f"https://www.booking.com/searchresults.en.html?ss={dest_encoded}",
            "airbnb": f"https://www.airbnb.com/s/{dest_encoded}/homes",
            "hostelworld": f"https://www.hostelworld.com/findabed.php/ChosenCity.{dest_encoded}",
        },
        "activities": {
            "getyourguide": f"https://www.getyourguide.com/{dest_slug}-l193/",
            "viator": f"https://www.viator.com/{dest_encoded}/d334-ttd",
        },
        "transport": {
            "rome2rio": f"https://www.rome2rio.com/s/{dest_slug}",
        }
    }


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
        response = call_gemini_with_retry(
            prompt=prompt,
            temperature=0.5,
            mime_type="application/json"
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
