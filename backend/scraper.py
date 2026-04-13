import requests
from bs4 import BeautifulSoup
import time
from urllib.parse import urlparse

# Define the 10 sources we want to scrape
TARGET_SOURCES = [
    {"name": "Reddit", "domain": "reddit.com"},
    {"name": "Lonely Planet", "domain": "lonelyplanet.com"},
    {"name": "TripAdvisor", "domain": "tripadvisor.com"},
    {"name": "Nomadic Matt", "domain": "nomadicmatt.com"},
    {"name": "The Points Guy", "domain": "thepointsguy.com"},
    {"name": "Rick Steves", "domain": "ricksteves.com"},
    {"name": "Travel + Leisure", "domain": "travelandleisure.com"},
    {"name": "Conde Nast Traveler", "domain": "cntraveler.com"},
    {"name": "WikiVoyage", "domain": "en.wikivoyage.org"},
    {"name": "Atlas Obscura", "domain": "atlasobscura.com"}
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def search_duckduckgo(query, max_results=2):
    """Fallback search using DuckDuckGo HTML to find relevant URLs."""
    url = "https://html.duckduckgo.com/html/"
    data = {"q": query}
    try:
        response = requests.post(url, data=data, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to search {query}: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    links = []
    for a in soup.find_all("a", class_="result__url"):
        href = a.get("href")
        if href and "duckduckgo" not in href:
            # duckduckgo often prepends its redirect, just clean it simply or keep the raw
            # The class result__url usually contains the actual snippet URL or we can use result__snippet
            link = a.text.strip()
            if link.startswith("http"):
                links.append(link)
            else:
                links.append("https://" + link)
            
            if len(links) >= max_results:
                break
    return links

def extract_text_from_url(url, max_chars=1500):
    """Scrape text content from a given URL."""
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.content, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()

        # Get text and clean it up
        text = soup.get_text(separator=' ', strip=True)
        return text[:max_chars] # Limit to avoid massive payloads
    except Exception as e:
        print(f"Failed to extract from {url}: {e}")
        return ""

def gather_destination_data_stream(destination: str):
    """Gathers brutally honest travel info from 10 sources and yields progress."""
    aggregated_text = []
    references = []
    
    total_sources = len(TARGET_SOURCES)
    for index, source in enumerate(TARGET_SOURCES):
        domain = source['domain']
        source_name = source['name']
        
        percent = int(((index) / total_sources) * 100)
        yield {
            "type": "progress",
            "percent": percent,
            "message": f"Searching {source_name}..."
        }
        
        query = f"site:{domain} {destination} travel review advice tips"
        print(f"Searching: {query}")
        
        urls = search_duckduckgo(query, max_results=1)
        if urls:
            for url in urls:
                yield {
                    "type": "progress",
                    "percent": percent + int((1 / total_sources) * 50), # rough halfway for this source
                    "message": f"Scraping from {source_name}..."
                }
                print(f"Scraping: {url}")
                content = extract_text_from_url(url)
                if content:
                    aggregated_text.append(f"--- SOURCE: {source_name} ({url}) ---\n{content}\n")
                    references.append({
                        "name": source_name,
                        "url": url,
                        "content_snippet": content[:500] # Give 500 chars snippet for rating
                    })
        
        # Sleep slightly to avoid DDG rate limits
        time.sleep(1.5)
        
    yield {
        "type": "complete",
        "percent": 100,
        "message": "Scraping complete. Requesting verdict from AI...",
        "context": "\n".join(aggregated_text),
        "references": references
    }
