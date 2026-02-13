import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.llm_client import chat_completion, vision_completion

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

SYSTEM_PROMPT = """You are AtlasIQ, a friendly and knowledgeable travel expert AI. You help users learn about countries and plan travel.

When answering about a specific country, include practical details like:
- Key highlights and must-visit places
- Best time to visit
- Local culture and customs
- Food recommendations
- Safety tips
- Budget expectations

Keep responses concise (3-5 sentences) unless the user asks for detail. Be enthusiastic but factual. Do not use markdown formatting."""


RESOLVE_SYSTEM = """You are a strict geography resolver. Given a place name (city, landmark, region, etc.), return ONLY a JSON object with these fields:
- "name": the country name this place belongs to
- "code": the ISO 3166-1 alpha-2 country code (uppercase)
- "lat": latitude of the specific place (not the country center)
- "lng": longitude of the specific place (not the country center)
- "place_name": the canonical name of the place

If the input is already a country name, return that country's info.
If the input is a landmark (e.g. "Eiffel Tower", "Machu Picchu"), return the country it's in with the landmark's coordinates.

CRITICAL: If the input is gibberish, random characters, nonsense text, misspelled beyond recognition, or NOT a real identifiable place, you MUST return {"name": null}. Do NOT guess or hallucinate a place. Only return a result when you are confident the input refers to a real, specific geographic location.

Return ONLY valid JSON, no markdown, no explanation."""


RESOLVE_IMAGE_SYSTEM = """You are a strict geography resolver with vision capabilities. Given a photograph, identify the place or landmark shown.

Return ONLY a JSON object with these fields:
- "name": the country name this place belongs to
- "code": the ISO 3166-1 alpha-2 country code (uppercase)
- "lat": latitude of the specific place shown in the photo
- "lng": longitude of the specific place shown in the photo
- "place_name": the canonical name of the place or landmark

CRITICAL: If the image does not clearly show an identifiable real-world place or landmark, you MUST return {"name": null}. Do NOT guess. Only return a result when you are confident the image shows a specific, recognizable geographic location.

Return ONLY valid JSON, no markdown, no explanation."""


MAX_IMAGE_BASE64_SIZE = 10 * 1024 * 1024  # ~10 MB of base64 text


class ResolvePlaceRequest(BaseModel):
    place: str


class ResolvePlaceResponse(BaseModel):
    name: str | None = None
    code: str = ""
    lat: float = 0
    lng: float = 0
    place_name: str = ""


@router.post("/resolve-place", response_model=ResolvePlaceResponse)
async def resolve_place(req: ResolvePlaceRequest):
    if not req.place.strip():
        raise HTTPException(status_code=400, detail="Place cannot be empty")
    try:
        raw = await chat_completion(
            prompt=f"Resolve this place: {req.place}",
            system=RESOLVE_SYSTEM,
            temperature=0.0,
            max_tokens=150,
        )
        # Parse JSON from response (strip markdown fences if any)
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        data = json.loads(text)
        if not data.get("name"):
            return ResolvePlaceResponse()
        return ResolvePlaceResponse(
            name=data["name"],
            code=data.get("code", ""),
            lat=float(data.get("lat", 0)),
            lng=float(data.get("lng", 0)),
            place_name=data.get("place_name", req.place),
        )
    except json.JSONDecodeError:
        logger.warning("Failed to parse resolve-place response: %s", raw)
        return ResolvePlaceResponse()
    except Exception as e:
        logger.exception("resolve-place failed")
        raise HTTPException(status_code=500, detail=str(e))


class ResolvePlaceImageRequest(BaseModel):
    image: str


@router.post("/resolve-place-image", response_model=ResolvePlaceResponse)
async def resolve_place_image(req: ResolvePlaceImageRequest):
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image data URL")
    if len(req.image) > MAX_IMAGE_BASE64_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max ~10MB)")
    try:
        raw = await vision_completion(
            image_base64=req.image,
            prompt="Identify the place or landmark in this photograph.",
            system=RESOLVE_IMAGE_SYSTEM,
            temperature=0.0,
            max_tokens=300,
        )
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        data = json.loads(text)
        if not data.get("name"):
            return ResolvePlaceResponse()
        return ResolvePlaceResponse(
            name=data["name"],
            code=data.get("code", ""),
            lat=float(data.get("lat", 0)),
            lng=float(data.get("lng", 0)),
            place_name=data.get("place_name", ""),
        )
    except json.JSONDecodeError:
        logger.warning("Failed to parse resolve-place-image response: %s", raw)
        return ResolvePlaceResponse()
    except Exception as e:
        logger.exception("resolve-place-image failed")
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    country_code: str = ""
    country_name: str = ""


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    context = ""
    if req.country_name:
        context = f"The user is currently looking at {req.country_name} ({req.country_code}) on the globe. "

    prompt = f"{context}User says: {req.message}"

    try:
        reply = await chat_completion(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=500,
        )
        return ChatResponse(reply=reply.strip())
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=str(e))
