import json
import logging
from urllib.parse import urlencode

from config import settings
from services.cache_service import TTLCache
from utils.llm_client import get_client

logger = logging.getLogger(__name__)

# 10-minute TTL for places results
_cache = TTLCache(ttl=600)


async def search_nearby_places(
    query: str,
    lat: float,
    lng: float,
    radius: int = 5000,
    max_results: int = 10,
) -> list[dict]:
    """Search for places near a location using Google Places API (New).
    Returns a list of normalized place dicts.
    """
    cache_key = f"places:{query}:{lat:.4f},{lng:.4f}:{radius}:{max_results}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    if not settings.google_places_api_key:
        logger.error("GOOGLE_PLACES_API_KEY not configured")
        return []

    client = get_client()

    # Google Places API (New) — Text Search
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.rating,places.userRatingCount,"
            "places.priceLevel,places.currentOpeningHours,"
            "places.types,places.photos,places.googleMapsUri"
        ),
    }
    body = {
        "textQuery": query,
        "maxResultCount": min(max_results, 20),
    }

    # Add locationBias when we have coordinates + a radius.
    # For "near me" queries the frontend provides user coords + radius.
    # For in-context searches the agent provides place coords + radius.
    # When radius=0 we skip it — Google infers location from query text.
    if radius > 0 and (lat != 0 or lng != 0):
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius),
            }
        }

    try:
        response = await client.post(url, headers=headers, json=body)
        if response.status_code != 200:
            logger.error("Google Places error %s: %s", response.status_code, response.text)
            return []

        data = response.json()
        raw_places = data.get("places", [])
        results = []

        for p in raw_places[:max_results]:
            location = p.get("location", {})
            opening_hours = p.get("currentOpeningHours", {})

            # Build photo URL (first photo, medium size)
            photo_url = ""
            photos = p.get("photos", [])
            if photos:
                photo_name = photos[0].get("name", "")
                if photo_name:
                    photo_url = (
                        f"https://places.googleapis.com/v1/{photo_name}/media"
                        f"?maxHeightPx=400&maxWidthPx=400"
                        f"&key={settings.google_places_api_key}"
                    )

            results.append({
                "id": p.get("id", ""),
                "name": p.get("displayName", {}).get("text", "Unknown"),
                "address": p.get("formattedAddress", ""),
                "lat": location.get("latitude", 0),
                "lng": location.get("longitude", 0),
                "rating": p.get("rating", 0),
                "review_count": p.get("userRatingCount", 0),
                "price_level": _normalize_price_level(p.get("priceLevel")),
                "is_open": opening_hours.get("openNow"),
                "types": _simplify_types(p.get("types", [])),
                "photo_url": photo_url,
                "maps_url": p.get("googleMapsUri", ""),
            })

        _cache.set(cache_key, results)
        return results

    except Exception as e:
        logger.exception("Failed to search nearby places: %s", e)
        return []


def _normalize_price_level(level) -> int:
    """Convert Google's price level enum to 1-4 int."""
    mapping = {
        "PRICE_LEVEL_FREE": 0,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    if isinstance(level, str):
        return mapping.get(level, 0)
    return 0


def _simplify_types(types: list[str]) -> list[str]:
    """Extract human-readable type tags from Google's type list."""
    # Keep useful types, strip internal ones
    skip = {"point_of_interest", "establishment", "food", "store"}
    readable = []
    for t in types:
        if t in skip:
            continue
        readable.append(t.replace("_", " ").title())
        if len(readable) >= 3:
            break
    return readable
