from fastapi import APIRouter, HTTPException

from models.country import Country
from services import country_service

router = APIRouter(prefix="/countries", tags=["countries"])


@router.get("", response_model=list[Country])
async def list_countries():
    return country_service.get_all()


@router.get("/{code}", response_model=Country)
async def get_country(code: str):
    country = country_service.get_by_code(code)
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country
