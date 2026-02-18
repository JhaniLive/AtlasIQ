"""Weather service using Open-Meteo API (free, no API key required)."""

import logging

import httpx

logger = logging.getLogger(__name__)

_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# WMO Weather interpretation codes → human-readable descriptions
_WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


async def get_current_weather(location: str) -> dict | None:
    """Fetch current weather for a location name.

    Returns a dict with weather data, or None on failure.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        # Step 1: Geocode location name → lat/lng
        geo_resp = await client.get(
            _GEO_URL, params={"name": location, "count": 1, "language": "en"}
        )
        geo_resp.raise_for_status()
        geo_data = geo_resp.json()

        results = geo_data.get("results")
        if not results:
            return None

        place = results[0]
        lat = place["latitude"]
        lng = place["longitude"]
        resolved_name = place.get("name", location)
        country = place.get("country", "")
        admin = place.get("admin1", "")  # state/province

        # Step 2: Fetch current weather
        weather_resp = await client.get(
            _WEATHER_URL,
            params={
                "latitude": lat,
                "longitude": lng,
                "current": ",".join([
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "precipitation",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "cloud_cover",
                    "is_day",
                ]),
                "timezone": "auto",
            },
        )
        weather_resp.raise_for_status()
        weather_data = weather_resp.json()

        current = weather_data.get("current", {})
        units = weather_data.get("current_units", {})
        weather_code = current.get("weather_code", 0)

        location_label = resolved_name
        if admin:
            location_label += f", {admin}"
        if country:
            location_label += f", {country}"

        return {
            "location": location_label,
            "lat": lat,
            "lng": lng,
            "timezone": weather_data.get("timezone", ""),
            "temperature_c": current.get("temperature_2m"),
            "feels_like_c": current.get("apparent_temperature"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "precipitation_mm": current.get("precipitation"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_direction_deg": current.get("wind_direction_10m"),
            "cloud_cover_percent": current.get("cloud_cover"),
            "is_day": current.get("is_day") == 1,
            "condition": _WMO_CODES.get(weather_code, "Unknown"),
            "weather_code": weather_code,
        }
