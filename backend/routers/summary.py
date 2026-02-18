import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from utils.llm_client import chat_completion

logger = logging.getLogger(__name__)

router = APIRouter(tags=["summary"])

limiter = Limiter(key_func=get_remote_address)

SUMMARY_SYSTEM = """You are AtlasIQ, an AI travel assistant. The user has been exploring the world using your platform and has gathered the data below. Write a personalized 3-5 paragraph travel summary/conclusion.

Guidelines:
- Address the user by name if provided
- Highlight common themes across their explorations (e.g. food focus, adventure, culture)
- Mention their top-rated or most-explored destinations
- Give 2-3 actionable recommendations or priorities based on their interests
- End with a warm, encouraging sendoff
- Keep it concise but insightful — aim for 200-350 words
- Use markdown formatting (bold, bullet points) where helpful"""


class CountryItem(BaseModel):
    name: str
    code: str = ""
    place_name: str = ""


class ChatHighlight(BaseModel):
    question: str
    answer: str = ""
    country: str = ""


class PlaceItem(BaseModel):
    name: str
    rating: float = 0
    country: str = ""


class BookmarkItem(BaseModel):
    name: str
    code: str = ""


class TripSummaryRequest(BaseModel):
    countries: list[CountryItem] = []
    searches: list[str] = []
    chat_highlights: list[ChatHighlight] = []
    places: list[PlaceItem] = []
    bookmarks: list[BookmarkItem] = []
    user_name: str = ""


class TripSummaryResponse(BaseModel):
    conclusion: str


@router.post("/trip-summary", response_model=TripSummaryResponse)
@limiter.limit("10/minute")
async def trip_summary(request: Request, req: TripSummaryRequest):
    # Build a structured prompt from the trip data
    parts = []

    if req.user_name:
        parts.append(f"User name: {req.user_name}")

    if req.countries:
        names = [f"{c.name}" + (f" ({c.place_name})" if c.place_name else "") for c in req.countries]
        parts.append(f"Countries explored: {', '.join(names)}")

    if req.searches:
        parts.append(f"Searches: {', '.join(req.searches[:20])}")

    if req.chat_highlights:
        highlights = []
        for ch in req.chat_highlights[:15]:
            h = f"Q: {ch.question}"
            if ch.answer:
                h += f" → A: {ch.answer[:200]}"
            if ch.country:
                h += f" (about {ch.country})"
            highlights.append(h)
        parts.append("Chat highlights:\n" + "\n".join(highlights))

    if req.places:
        place_strs = [
            f"{p.name} (★{p.rating:.1f})" + (f" in {p.country}" if p.country else "")
            for p in req.places[:30]
        ]
        parts.append(f"Places discovered: {', '.join(place_strs)}")

    if req.bookmarks:
        bm_names = [b.name for b in req.bookmarks]
        parts.append(f"Bookmarked: {', '.join(bm_names)}")

    if not parts:
        raise HTTPException(status_code=400, detail="No trip data provided")

    prompt = "Generate a trip summary based on this exploration data:\n\n" + "\n\n".join(parts)

    try:
        conclusion = await chat_completion(
            prompt=prompt,
            system=SUMMARY_SYSTEM,
            temperature=0.7,
            max_tokens=800,
        )
        return TripSummaryResponse(conclusion=conclusion.strip())
    except Exception as e:
        logger.exception("Trip summary generation failed")
        raise HTTPException(status_code=500, detail=str(e))
