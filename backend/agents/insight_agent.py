from agents.base_agent import BaseAgent
from utils.llm_client import chat_completion

SYSTEM_PROMPT = """You are a travel expert. Given a country name and a user's travel interests, write a brief 2-3 sentence insight about why this country would be a great match for them. Be specific and enthusiastic. Do not use markdown formatting."""


class InsightAgent(BaseAgent):
    name = "insight"

    async def run(self, input_data: dict) -> dict:
        country_name: str = input_data["country_name"]
        interests: str = input_data["interests"]
        score: float = input_data["score"]

        prompt = (
            f"Country: {country_name}\n"
            f"Match score: {score}/10\n"
            f"User interests: {interests}\n\n"
            f"Write a short insight about why {country_name} matches these interests."
        )

        insight = await chat_completion(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=200,
        )

        return {"insight": insight.strip()}
