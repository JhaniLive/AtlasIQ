from pydantic import BaseModel


class UserPreferences(BaseModel):
    interests: str


class WeightedPreferences(BaseModel):
    safety_index: float = 0.0
    beach_score: float = 0.0
    nightlife_score: float = 0.0
    cost_of_living: float = 0.0
    sightseeing_score: float = 0.0
    cultural_score: float = 0.0
    adventure_score: float = 0.0
    food_score: float = 0.0
    infrastructure_score: float = 0.0
    climate_preference: str = ""

    @property
    def weight_dict(self) -> dict[str, float]:
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
