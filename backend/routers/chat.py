import json
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from agents.react_agent import ReActAgent
from services.country_service import get_by_code
from utils.json_helpers import clean_json_response
from utils.llm_client import chat_completion, chat_completion_with_history, vision_completion

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

limiter = Limiter(key_func=get_remote_address)

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
@limiter.limit("30/minute")
async def resolve_place(request: Request, req: ResolvePlaceRequest):
    if not req.place.strip():
        raise HTTPException(status_code=400, detail="Place cannot be empty")
    try:
        raw = await chat_completion(
            prompt=f"Resolve this place: {req.place}",
            system=RESOLVE_SYSTEM,
            temperature=0.0,
            max_tokens=150,
        )
        data = json.loads(clean_json_response(raw))
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
@limiter.limit("10/minute")
async def resolve_place_image(request: Request, req: ResolvePlaceImageRequest):
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
        data = json.loads(clean_json_response(raw))
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


class ChatMessage(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    message: str
    country_code: str = ""
    country_name: str = ""
    history: list[ChatMessage] = []
    use_agent: bool = True


class ChatResponse(BaseModel):
    reply: str
    thoughts: list[str] = []
    iterations: int = 0


MAX_HISTORY = 20

react_agent = ReActAgent()


def _build_rag_context(country_code: str, country_name: str) -> tuple[str, str]:
    """Build user context prefix and RAG context from country data.
    Returns (context, rag_context) strings.
    """
    context = ""
    rag_context = ""
    if country_code:
        country_data = get_by_code(country_code)
        if country_data:
            context = f"The user is currently looking at {country_name} ({country_code}) on the globe. "
            scores = country_data.score_fields
            score_lines = ", ".join(f"{k}: {v}" for k, v in scores.items())
            rag_context = (
                f"\n\nREAL DATA for {country_data.name} ({country_data.code}):\n"
                f"Climate: {country_data.climate}\n"
                f"Scores (out of 10): {score_lines}\n"
                f"Use these real scores when answering. Do not contradict them."
            )
    elif country_name:
        context = f"The user is currently looking at {country_name} on the globe. "
    return context, rag_context


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat(request: Request, req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    context, rag_context = _build_rag_context(req.country_code, req.country_name)

    # Build conversation history messages
    history_messages = []
    for m in req.history[-MAX_HISTORY:]:
        role = "assistant" if m.role == "ai" else "user"
        history_messages.append({"role": role, "content": m.text})

    # Current user message with country context
    user_content = f"{context}User says: {req.message}" if context else req.message
    history_messages.append({"role": "user", "content": user_content})

    try:
        if req.use_agent:
            # ReAct agent path — tool-calling loop
            result = await react_agent.run(
                messages=history_messages,
                country_code=req.country_code,
                rag_context=rag_context,
            )
            return ChatResponse(
                reply=result["reply"],
                thoughts=result.get("thoughts", []),
                iterations=result.get("iterations", 0),
            )
        else:
            # Simple chat path — single LLM call, cheaper and faster
            system_content = SYSTEM_PROMPT + rag_context
            messages = [{"role": "system", "content": system_content}] + history_messages
            reply = await chat_completion_with_history(
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            return ChatResponse(reply=reply.strip())
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=str(e))
