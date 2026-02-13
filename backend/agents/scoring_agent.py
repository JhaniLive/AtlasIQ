from agents.base_agent import BaseAgent
from models.country import Country
from models.preferences import WeightedPreferences
from services.scoring_service import rank_countries


class ScoringAgent(BaseAgent):
    name = "scoring"

    async def run(self, input_data: dict) -> dict:
        countries: list[Country] = input_data["countries"]
        preferences: WeightedPreferences = input_data["preferences"]
        top_n: int = input_data.get("top_n", 5)

        ranked = rank_countries(countries, preferences, top_n)

        return {
            "rankings": [
                {"country": country, "score": score}
                for country, score in ranked
            ]
        }
