import asyncio
import json
import logging
from functools import partial

from ddgs import DDGS

from services.country_service import get_all, get_by_code
from services.places_service import search_nearby_places as _search_nearby
from services.weather_service import get_current_weather

logger = logging.getLogger(__name__)

# ── Tool implementations ─────────────────────────────────────────────


async def search_countries(params: dict) -> str:
    """Filter/search countries by criteria."""
    query = params.get("query", "").lower()
    climate = params.get("climate", "").lower()
    min_score_field = params.get("min_score_field", "")
    min_score_value = float(params.get("min_score_value", 0))

    results = []
    for c in get_all():
        if query and query not in c.name.lower():
            continue
        if climate and climate != c.climate.lower():
            continue
        if min_score_field and hasattr(c, min_score_field):
            if getattr(c, min_score_field) < min_score_value:
                continue
        results.append({
            "name": c.name,
            "code": c.code,
            "climate": c.climate,
            **c.score_fields,
        })

    if not results:
        return json.dumps({"results": [], "message": "No countries matched your criteria."})
    return json.dumps({"results": results[:20], "total": len(results)})


async def get_country_details(params: dict) -> str:
    """Get full country data by ISO code."""
    code = params.get("code", "")
    country = get_by_code(code)
    if not country:
        return json.dumps({"error": f"Country not found for code: {code}"})
    return json.dumps({
        "name": country.name,
        "code": country.code,
        "climate": country.climate,
        "lat": country.lat,
        "lng": country.lng,
        **country.score_fields,
    })


async def compare_countries(params: dict) -> str:
    """Side-by-side comparison of 2-4 countries."""
    codes = params.get("codes", [])
    if not codes or len(codes) < 2:
        return json.dumps({"error": "Provide at least 2 country codes to compare."})

    countries = []
    for code in codes[:4]:
        c = get_by_code(code)
        if c:
            countries.append({
                "name": c.name,
                "code": c.code,
                "climate": c.climate,
                **c.score_fields,
            })

    if len(countries) < 2:
        return json.dumps({"error": "Could not find enough countries for comparison."})
    return json.dumps({"comparison": countries})


async def get_travel_tips(params: dict) -> str:
    """Structured travel tips derived from country scores."""
    code = params.get("code", "")
    c = get_by_code(code)
    if not c:
        return json.dumps({"error": f"Country not found for code: {code}"})

    safety_level = "Very Safe" if c.safety_index >= 8 else "Safe" if c.safety_index >= 6 else "Exercise Caution" if c.safety_index >= 4 else "High Risk"
    budget_level = "Budget-Friendly" if c.cost_of_living >= 7 else "Moderate" if c.cost_of_living >= 4 else "Expensive"

    highlights = []
    if c.beach_score >= 7:
        highlights.append("Great beaches")
    if c.food_score >= 7:
        highlights.append("Excellent cuisine")
    if c.cultural_score >= 7:
        highlights.append("Rich culture & history")
    if c.adventure_score >= 7:
        highlights.append("Adventure activities")
    if c.nightlife_score >= 7:
        highlights.append("Vibrant nightlife")
    if c.sightseeing_score >= 7:
        highlights.append("Top sightseeing")

    return json.dumps({
        "country": c.name,
        "safety_level": safety_level,
        "safety_score": c.safety_index,
        "budget_level": budget_level,
        "cost_score": c.cost_of_living,
        "climate": c.climate,
        "highlights": highlights or ["General tourism"],
        "infrastructure_score": c.infrastructure_score,
    })


async def rank_by_preference(params: dict) -> str:
    """Rank all countries by a specific score field."""
    field = params.get("field", "")
    top_n = int(params.get("top_n", 10))

    all_countries = get_all()
    if not field or not hasattr(all_countries[0], field):
        valid = list(all_countries[0].score_fields.keys())
        return json.dumps({"error": f"Invalid field: {field}. Valid fields: {valid}"})

    sorted_countries = sorted(all_countries, key=lambda c: getattr(c, field), reverse=True)
    results = [
        {"rank": i + 1, "name": c.name, "code": c.code, field: getattr(c, field)}
        for i, c in enumerate(sorted_countries[:top_n])
    ]
    return json.dumps({"field": field, "top": results})


async def search_nearby_places(params: dict) -> str:
    """Search for real places/restaurants/attractions using Google Places."""
    query = params.get("query", "")
    lat = float(params.get("lat", 0))
    lng = float(params.get("lng", 0))
    radius = int(params.get("radius", 0))

    if not query:
        return json.dumps({"error": "query is required"})

    # When lat/lng are 0 (no user location), set radius=0 so the backend
    # skips locationBias — Google infers location from the query text itself.
    if lat == 0 and lng == 0:
        radius = 0

    places = await _search_nearby(query=query, lat=lat, lng=lng, radius=radius, max_results=10)
    if not places:
        return json.dumps({"results": [], "message": "No places found nearby."})

    # Slim output for LLM context
    slim = []
    for p in places:
        entry = {
            "name": p["name"],
            "rating": p["rating"],
            "review_count": p["review_count"],
            "address": p["address"],
        }
        if p.get("is_open") is not None:
            entry["is_open"] = p["is_open"]
        slim.append(entry)

    return json.dumps({"results": slim, "total": len(slim)})


async def web_search(params: dict) -> str:
    """Search the web using DuckDuckGo for real-time information."""
    query = params.get("query", "")
    max_results = int(params.get("max_results", 5))

    if not query:
        return json.dumps({"error": "query is required"})

    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, partial(_ddgs_text, query, min(max_results, 10))
        )
        if not results:
            return json.dumps({"results": [], "message": "No results found."})

        slim = []
        for r in results:
            slim.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", ""),
            })
        return json.dumps({"results": slim, "total": len(slim)})
    except Exception as e:
        logger.exception("Web search failed")
        return json.dumps({"error": f"Search failed: {str(e)}"})


async def news_search(params: dict) -> str:
    """Search for latest news using DuckDuckGo News."""
    query = params.get("query", "")
    max_results = int(params.get("max_results", 5))

    if not query:
        return json.dumps({"error": "query is required"})

    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, partial(_ddgs_news, query, min(max_results, 10))
        )
        if not results:
            return json.dumps({"results": [], "message": "No news found."})

        slim = []
        for r in results:
            slim.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("url", ""),
                "source": r.get("source", ""),
                "date": r.get("date", ""),
            })
        return json.dumps({"results": slim, "total": len(slim)})
    except Exception as e:
        logger.exception("News search failed")
        return json.dumps({"error": f"News search failed: {str(e)}"})


async def get_weather(params: dict) -> str:
    """Get current weather for a location."""
    location = params.get("location", "")
    if not location:
        return json.dumps({"error": "location is required"})

    try:
        result = await get_current_weather(location)
        if not result:
            return json.dumps({"error": f"Could not find weather for '{location}'. Try a more specific location name."})
        return json.dumps(result)
    except Exception as e:
        logger.exception("Weather fetch failed")
        return json.dumps({"error": f"Weather fetch failed: {str(e)}"})


def _ddgs_text(query: str, max_results: int) -> list[dict]:
    """Sync helper — runs in thread executor."""
    with DDGS() as ddgs:
        return list(ddgs.text(query, max_results=max_results))


def _ddgs_news(query: str, max_results: int) -> list[dict]:
    """Sync helper — runs in thread executor."""
    with DDGS() as ddgs:
        return list(ddgs.news(query, max_results=max_results))


# ── Tool registry ────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_countries",
        "description": "Search and filter countries by name, climate type, or minimum score in a category. Returns up to 20 matching countries with all their scores.",
        "parameters": {
            "query": "(optional) Country name substring to search for",
            "climate": "(optional) Filter by climate: tropical, arid, temperate, continental",
            "min_score_field": "(optional) Score field name to filter by minimum value",
            "min_score_value": "(optional) Minimum score value (0-10)",
        },
    },
    {
        "name": "get_country_details",
        "description": "Get full details for a specific country by its ISO 3166-1 alpha-2 code (e.g. 'JP' for Japan, 'TH' for Thailand).",
        "parameters": {
            "code": "(required) ISO 3166-1 alpha-2 country code, uppercase",
        },
    },
    {
        "name": "compare_countries",
        "description": "Compare 2-4 countries side by side on all scores. Provide an array of ISO country codes.",
        "parameters": {
            "codes": "(required) Array of 2-4 ISO country codes, e.g. [\"JP\", \"TH\"]",
        },
    },
    {
        "name": "get_travel_tips",
        "description": "Get structured travel tips for a country including safety level, budget level, climate, and highlights derived from real data.",
        "parameters": {
            "code": "(required) ISO 3166-1 alpha-2 country code",
        },
    },
    {
        "name": "rank_by_preference",
        "description": "Rank all countries by a specific score field and return the top N. Fields: safety_index, beach_score, nightlife_score, cost_of_living, sightseeing_score, cultural_score, adventure_score, food_score, infrastructure_score.",
        "parameters": {
            "field": "(required) The score field to rank by",
            "top_n": "(optional) Number of top results to return, default 10",
        },
    },
    {
        "name": "search_nearby_places",
        "description": "Search for real places, restaurants, attractions, sightseeing spots, hotels, cafes, etc. using Google Places. Use this whenever the user asks for specific local businesses, food spots, things to do, sightseeing, or places to visit. Include the location in the query text (e.g. 'biryani restaurants in Hyderabad'). Coordinates are optional — if you have them (from user location), pass them; otherwise just put the location name in the query and Google will find it.",
        "parameters": {
            "query": "(required) What to search for INCLUDING the location, e.g. 'biryani restaurants in India', 'sightseeing places in USA', 'coffee shops in Paris'",
            "lat": "(optional) Latitude — pass if user's location is known, otherwise omit or use 0",
            "lng": "(optional) Longitude — pass if user's location is known, otherwise omit or use 0",
            "radius": "(optional) Search radius in meters. Use 5000 for 'near me' queries. Omit or use 0 for city/country queries where location is in the query text",
        },
    },
    {
        "name": "web_search",
        "description": "Search the web for real-time information using DuckDuckGo. Use this for current events, recent updates, travel advisories, weather, or any question that needs up-to-date info beyond your training data.",
        "parameters": {
            "query": "(required) The search query",
            "max_results": "(optional) Number of results to return, default 5, max 10",
        },
    },
    {
        "name": "news_search",
        "description": "Search for the latest news articles using DuckDuckGo News. Use this when the user asks about latest news, recent events, current happenings, or breaking news about a country or place.",
        "parameters": {
            "query": "(required) The news search query, e.g. 'London latest news', 'Japan earthquake'",
            "max_results": "(optional) Number of results to return, default 5, max 10",
        },
    },
    {
        "name": "get_weather",
        "description": "Get current real-time weather for any city or location. Returns temperature, feels-like, humidity, wind, cloud cover, and conditions. Use this whenever the user asks about weather, temperature, climate right now, or 'is it raining/hot/cold in X'.",
        "parameters": {
            "location": "(required) City or place name, e.g. 'London', 'Tokyo', 'New York', 'Dubai'",
        },
    },
]

TOOL_MAP = {
    "search_countries": search_countries,
    "get_country_details": get_country_details,
    "compare_countries": compare_countries,
    "get_travel_tips": get_travel_tips,
    "rank_by_preference": rank_by_preference,
    "search_nearby_places": search_nearby_places,
    "web_search": web_search,
    "news_search": news_search,
    "get_weather": get_weather,
}


def get_tools_for_prompt() -> str:
    """Format all tools as text for inclusion in the system prompt."""
    lines = ["You have access to the following tools:\n"]
    for tool in TOOLS:
        lines.append(f"### {tool['name']}")
        lines.append(f"{tool['description']}")
        lines.append("Parameters:")
        for param, desc in tool["parameters"].items():
            lines.append(f"  - {param}: {desc}")
        lines.append("")
    return "\n".join(lines)
