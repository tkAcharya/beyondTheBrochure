# 🧳 Beyond The Brochure
### *Because the travel influencer lied to you.*

> **"Paris smells. Bali is overrun. And yes, that 'hidden gem' has 4,000 TripAdvisor reviews."**
> — Your new brutally honest travel advisor

**Beyond The Brochure** is a Chrome extension that cuts through the glossy tourist-trap PR and tells you the *actual* truth about any travel destination — pulling from Reddit rants, Lonely Planet, TripAdvisor, and 7 other real sources, synthesized by Gemini AI into an unfiltered verdict.

No fluff. No sponsored posts. Just the facts.

---

## 🗺️ The Problem

Every travel blog, influencer reel, and tourism site is **selling you something**. They'll show you the golden-hour photo but not the 4-hour queue. The "authentic local experience" that costs 6x more than it should. The beach resort during monsoon season.

**The internet has the truth — but it's buried in Reddit threads, 3-star reviews, and forum posts.** Nobody has the time or patience to dig through 10 different sources before booking a trip.

**Beyond The Brochure** does it in 60 seconds. You type a destination. The extension scrapes 10 trusted (and untrusted) sources, feeds it all to Gemini AI, and gets you:

- 🤫 **Hidden Truths** — the scams, traps, and things locals won't tell tourists
- ⛈️ **Monsoon / Crowd Risks** — when *not* to go
- 💸 **Realistic Budget** — not the "budget traveler" blogger fantasy
- 🧭 **Off-Radar Tips** — non-cliché alternatives to main attractions
- 💬 **User Sentiments** — what real people online actually think
- 🏡 **Staycation Picks** — often-overlooked nearby alternatives
- 🎯 **Blunt Verdict** — a single no-nonsense summary with an emoji rating

---

## 📸 Demo
[YoutubeDemo](https://www.youtube.com/watch?v=AhD0L2iNRyc)

> *Screenshots and recordings of the extension in action*
<img width="618" height="627" alt="image" src="https://github.com/user-attachments/assets/7d379ced-d5d4-420e-b648-c817f67edab4" />

<img width="658" height="617" alt="image" src="https://github.com/user-attachments/assets/c767b798-d313-40e1-8697-94cf157fd3dd" />

| Feature | Preview |
|---|---|
| 🔍 Enter destination & analyze | *[Add screenshot]* |
| ⏳ Live scraping progress bar | *[Add screenshot]* |
| 📊 Analysis results with cards | *[Add screenshot]* |
| 🔗 Rated references tab | *[Add screenshot]* |

> 💡 **Tip:** Record a short screen capture using any screen recorder and drop it here as a GIF for maximum impact.

---

## 🚀 How to Run It

### Prerequisites

- Python 3.10+
- Google Chrome (for the extension)
- A Gemini API Key ([get one here ↗](https://aistudio.google.com/app/apikey))

---

### 🔑 Setting Up Your Gemini API Key

```
Google AI Studio → Create API Key → Copy Key
         ↓
  beyondTheBrochure/
  └── backend/
      ├── .env.example   ← copy this file
      └── .env           ← paste your key here
```

**Step-by-step:**

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"** and copy it
4. In the `backend/` folder, **duplicate** `.env.example` and rename it to `.env`
5. Open `.env` and replace the placeholder:

```env
# backend/.env
GEMINI_API_KEY="paste-your-key-here"
GEMINI_MODEL="gemini-2.0-flash-lite"
```

---

### 🖥️ 1. Start the Backend Server

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate         # Windows
# source venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
venv\Scripts\uvicorn main:app --reload
```

The backend will be live at **`http://127.0.0.1:8000`**

---

### 🧩 2. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `extension/` folder from this repo
5. The **Travel Analyst** icon will appear in your Chrome toolbar

---

### ✅ 3. Verify Everything Works

```bash
# Optional: Run the verify script to confirm setup
cd backend
python verify.py

# Optional: Run backend tests
python test_main.py
```

---

## 📁 Project Structure

```
beyondTheBrochure/
│
├── backend/                      # Python FastAPI server
│   ├── main.py                   # API endpoints (/analyze, /rate-reference)
│   ├── scraper.py                # Web scraper for 10 travel sources
│   ├── requirements.txt          # Python dependencies
│   ├── verify.py                 # Setup verification script
│   ├── test_main.py              # Backend test suite
│   ├── .env.example              # Template for environment variables
│   └── .env                      # Your API keys (git-ignored ✅)
│
└── extension/                    # Chrome Extension (Manifest V3)
    ├── manifest.json             # Extension config & permissions
    ├── popup.html                # Extension popup UI structure
    ├── popup.css                 # Glassmorphism-styled CSS
    └── popup.js                  # Frontend logic & API communication
```

---

## 🏗️ Architecture

<details>
<summary><strong>Click to expand — System Architecture</strong></summary>

### High-Level Flow

```
User types destination in Chrome Extension
         ↓
popup.js sends POST /analyze to FastAPI backend
         ↓
backend/scraper.py streams progress updates (NDJSON)
         ↓
    For each of 10 sources:
    1. DuckDuckGo search: "site:reddit.com {destination} travel tips"
    2. Scrape matching URL with requests + BeautifulSoup
    3. Yield progress event → Extension shows live % progress
         ↓
All scraped text assembled into a single context block
         ↓
Gemini API called with system prompt + context
         ↓
Structured JSON response returned:
{hidden_truths, monsoon_risks, budget, tips, verdict, ...}
         ↓
popup.js renders cards with the analysis
         ↓
User can click any reference → POST /rate-reference
         ↓
Gemini rates the source's reliability (rating + reason)
```

### Component Breakdown

| Component | Technology | Role |
|---|---|---|
| Chrome Extension (UI) | HTML, CSS, Vanilla JS | Captures user input, renders results, calls backend |
| FastAPI Backend | Python, FastAPI | Orchestrates scraping + AI calls, streams results |
| Web Scraper | requests, BeautifulSoup | Fetches and parses 10 travel sites via DuckDuckGo |
| AI Engine | Google Gemini API | Synthesizes scraped data into structured travel insights |
| Streaming Protocol | NDJSON (newline-delimited JSON) | Enables real-time progress updates from backend to extension |

### 10 Scraped Sources

| # | Source | Domain |
|---|---|---|
| 1 | Reddit | reddit.com |
| 2 | Lonely Planet | lonelyplanet.com |
| 3 | TripAdvisor | tripadvisor.com |
| 4 | Nomadic Matt | nomadicmatt.com |
| 5 | The Points Guy | thepointsguy.com |
| 6 | Rick Steves | ricksteves.com |
| 7 | Travel + Leisure | travelandleisure.com |
| 8 | Condé Nast Traveler | cntraveler.com |
| 9 | WikiVoyage | en.wikivoyage.org |
| 10 | Atlas Obscura | atlasobscura.com |

</details>

---

## 🤖 Why This Problem Matters

<details>
<summary><strong>Click to expand — The "Why" behind Beyond The Brochure</strong></summary>

### The Broken State of Travel Information

Travel content online has a **fundamental incentive misalignment**:

- **Tourism boards** fund articles that only ever praise destinations
- **Travel bloggers** monetize through affiliate links and sponsored stays
- **Aggregator sites** surface paid placements and SEO-gamed content
- **Social media** rewards aesthetics over accuracy

The result? A tourist who planned a "dream trip" to South-East Asia in July — during the height of monsoon season — because every article they read said it was *"a bit rainy but still beautiful."*

### What AI + Real Sources Can Fix

The actual truth about any destination **exists online** — in Reddit r/travel threads, 3-star TripAdvisor reviews, Lonely Planet forums, and travel blogger comment sections. It's just scattered, buried, and takes hours to surface.

**Beyond The Brochure automates this:**

1. **Multi-source aggregation** — no single biased source, but 10 cross-referenced ones
2. **AI synthesis** — Gemini doesn't just summarize, it extracts *what tourists consistently get wrong*
3. **Reference rating** — every scraped source gets an AI reliability score, keeping the system honest about its own inputs
4. **Streaming UX** — real-time progress transparency, not a black box

### Where the Gemini AI Is Used

| Endpoint | Model Call | Purpose |
|---|---|---|
| `POST /analyze` | `client.models.generate_content()` | Synthesizes 10 scraped sources → structured 8-field JSON verdict |
| `POST /rate-reference` | `client.models.generate_content()` | Rates a single source snippet for reliability (rating + reason) |

Both calls use `response_mime_type="application/json"` to get structured outputs directly, with a system instruction that enforces the "brutally honest analyst" persona on the `/analyze` call.

</details>

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| **Extension** | HTML5, CSS3 (glassmorphism), Vanilla JS, Chrome Manifest V3 |
| **Backend** | Python, FastAPI, Uvicorn |
| **Scraping** | requests, BeautifulSoup4, DuckDuckGo HTML search |
| **AI** | Google Gemini (`google-genai` SDK) |
| **Env Management** | python-dotenv |

> **Note for instructors:** The backend invokes **Google Gemini** via the `google-genai` SDK (`client.models.generate_content`). The primary model is `GEMINI_MODEL` in `backend/.env` (code default: `gemini-2.5-flash-lite`). If that model exhausts retries without a successful response, **`call_gemini_with_retry()`** in `backend/main.py` automatically tries a **fallback model** (`gemini-2.5-flash`) before failing.

---

## ⚠️ Known Limitations

- Some sites (Reddit, TripAdvisor) may block scraping — the system degrades gracefully and still uses Gemini's internal knowledge
- DuckDuckGo rate limits may cause occasional scraping gaps
- CORS is open in dev mode — restrict `allow_origins` before any production deployment

---

*Made with ☕, frustration at travel PR, and a ruthless AI.*
