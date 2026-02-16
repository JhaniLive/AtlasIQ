from agents.base_agent import BaseAgent
from models.preferences import WeightedPreferences
from utils.json_helpers import parse_json_with_retry

SYSTEM_PROMPT = """You are a travel preference analyzer. Given a user's travel interests described in natural language, output a JSON object with numerical weights (0.0 to 1.0) for each category.

Categories:
- safety_index: importance of safety
- beach_score: interest in beaches
- nightlife_score: interest in nightlife/parties
- cost_of_living: preference for affordable destinations (higher = wants cheaper)
- sightseeing_score: interest in tourist attractions/landmarks
- cultural_score: interest in culture, history, museums
- adventure_score: interest in adventure activities (hiking, diving, etc.)
- food_score: interest in food/cuisine
- infrastructure_score: importance of good transport/facilities
- climate_preference: preferred climate type (one of: "tropical", "arid", "temperate", "continental", "" for no preference)

Respond with ONLY valid JSON, no markdown formatting, no explanation."""


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(self, input_data: dict) -> dict:
        interests = input_data["interests"]
        prompt = f"User's travel interests: {interests}"

        weights = await parse_json_with_retry(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=512,
            max_retries=2,
        )
        preferences = WeightedPreferences(**weights)
        return {"preferences": preferences, "raw_response": weights}
