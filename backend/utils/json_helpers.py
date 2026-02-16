import json
import logging

from utils.llm_client import chat_completion

logger = logging.getLogger(__name__)


def clean_json_response(raw: str) -> str:
    """Strip markdown code fences and whitespace from an LLM JSON response."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.rsplit("```", 1)[0]
    return text.strip()


async def parse_json_with_retry(
    prompt: str,
    system: str,
    temperature: float = 0.3,
    max_tokens: int = 512,
    max_retries: int = 2,
) -> dict:
    """Call the LLM, parse JSON from the response, retry with error feedback on failure."""
    last_error = None
    current_prompt = prompt

    for attempt in range(1 + max_retries):
        raw = await chat_completion(
            prompt=current_prompt,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        cleaned = clean_json_response(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(
                "JSON parse failed (attempt %d/%d): %s — raw: %.200s",
                attempt + 1, 1 + max_retries, e, raw,
            )
            # Build a retry prompt with error feedback
            current_prompt = (
                f"{prompt}\n\n"
                f"Your previous response was not valid JSON. Error: {e}\n"
                f"Previous response: {raw[:500]}\n"
                f"Please respond with ONLY valid JSON, no markdown, no explanation."
            )

    raise last_error
