from agents.base_agent import BaseAgent
from utils.llm_client import chat_completion

SYSTEM_PROMPT = """You are a travel advisor. Given a ranked list of top countries with their scores and a user's interests, write a brief 3-4 sentence explanation of why these countries were chosen as the top picks. Reference specific strengths of the top picks. Do not use markdown formatting."""


class ExplanationAgent(BaseAgent):
    name = "explanation"

    async def run(self, input_data: dict) -> dict:
        rankings: list[dict] = input_data["rankings"]
        interests: str = input_data["interests"]

        country_list = "\n".join(
            f"- {r['name']} (score: {r['score']})" for r in rankings
        )

        prompt = (
            f"User interests: {interests}\n\n"
            f"Top ranked countries:\n{country_list}\n\n"
            f"Explain why these countries are the best matches."
        )

        explanation = await chat_completion(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=300,
        )

        return {"explanation": explanation.strip()}
