from pydantic import BaseModel


class Country(BaseModel):
    name: str
    code: str
    lat: float
    lng: float
    safety_index: float
    beach_score: float
    nightlife_score: float
    cost_of_living: float
    climate: str
    sightseeing_score: float
    cultural_score: float
    adventure_score: float
    food_score: float
    infrastructure_score: float

    @property
    def score_fields(self) -> dict[str, float]:
        return {
            "safety_index": self.safety_index,
            "beach_score": self.beach_score,
            "nightlife_score": self.nightlife_score,
            "cost_of_living": self.cost_of_living,
            "sightseeing_score": self.sightseeing_score,
            "cultural_score": self.cultural_score,
            "adventure_score": self.adventure_score,
            "food_score": self.food_score,
            "infrastructure_score": self.infrastructure_score,
        }
