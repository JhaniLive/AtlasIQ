import json

from agents.base_agent import BaseAgent
from models.preferences import WeightedPreferences
from utils.llm_client import chat_completion

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

        raw = await chat_completion(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=512,
        )

        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        weights = json.loads(cleaned)
        preferences = WeightedPreferences(**weights)
        return {"preferences": preferences, "raw_response": raw}
