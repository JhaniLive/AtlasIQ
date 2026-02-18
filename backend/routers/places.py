import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.places_service import search_nearby_places

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/places", tags=["places"])

limiter = Limiter(key_func=get_remote_address)


class NearbyRequest(BaseModel):
    query: str
    latitude: float
    longitude: float
    radius: int = 5000
    max_results: int = 10


class PlaceItem(BaseModel):
    id: str = ""
    name: str = ""
    address: str = ""
    lat: float = 0
    lng: float = 0
    rating: float = 0
    review_count: int = 0
    price_level: int = 0
    is_open: bool | None = None
    types: list[str] = []
    photo_url: str = ""
    maps_url: str = ""


class NearbyResponse(BaseModel):
    places: list[PlaceItem] = []
    query: str = ""
    center_lat: float = 0
    center_lng: float = 0


@router.post("/nearby", response_model=NearbyResponse)
@limiter.limit("20/minute")
async def nearby_places(request: Request, req: NearbyRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if not (-90 <= req.latitude <= 90) or not (-180 <= req.longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")

    places = await search_nearby_places(
        query=req.query,
        lat=req.latitude,
        lng=req.longitude,
        radius=min(req.radius, 50000),
        max_results=min(req.max_results, 20),
    )

    return NearbyResponse(
        places=[PlaceItem(**p) for p in places],
        query=req.query,
        center_lat=req.latitude,
        center_lng=req.longitude,
    )
