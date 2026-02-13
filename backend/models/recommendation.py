from pydantic import BaseModel


class CountryScore(BaseModel):
    code: str
    name: str
    score: float
    insight: str = ""


class RecommendationResponse(BaseModel):
    rankings: list[CountryScore]
    explanation: str = ""
    interests_parsed: str = ""
