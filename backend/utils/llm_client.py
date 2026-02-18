import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=60.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _client


async def close_client():
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _call_llm(client: httpx.AsyncClient, base_url: str, api_key: str,
                     model: str, messages: list[dict],
                     temperature: float, max_tokens: int) -> httpx.Response:
    """Single LLM call to any OpenAI-compatible endpoint."""
    return await client.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )


# OpenRouter free models to try in order when primary is rate-limited
_FALLBACK_MODELS = [
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]


async def _call_with_fallback(client: httpx.AsyncClient, messages: list[dict],
                               temperature: float, max_tokens: int,
                               model: str | None = None) -> httpx.Response:
    """Try primary (Groq), fall back to OpenRouter on 429."""
    primary_model = model or settings.default_model
    response = await _call_llm(
        client, settings.openrouter_base_url, settings.openrouter_api_key,
        primary_model, messages, temperature, max_tokens,
    )

    if response.status_code != 429:
        return response

    # Primary rate-limited — try OpenRouter fallbacks
    if not settings.fallback_api_key:
        logger.error("Primary LLM rate-limited and no fallback API key configured")
        return response

    logger.warning("Primary model %s rate-limited, trying OpenRouter fallbacks...", primary_model)

    # Build fallback list: configured model first, then others
    fallbacks = [settings.fallback_model] + [m for m in _FALLBACK_MODELS if m != settings.fallback_model]

    for fb_model in fallbacks:
        logger.info("Trying fallback: %s", fb_model)
        response = await _call_llm(
            client, settings.fallback_base_url, settings.fallback_api_key,
            fb_model, messages, temperature, max_tokens,
        )
        if response.status_code == 200:
            logger.info("Fallback %s succeeded", fb_model)
            return response
        if response.status_code != 429:
            return response
        logger.warning("Fallback %s also rate-limited, trying next...", fb_model)

    logger.error("All fallback models exhausted")
    return response


async def chat_completion(
    prompt: str,
    system: str = "",
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    client = get_client()
    response = await _call_with_fallback(client, messages, temperature, max_tokens, model)
    if response.status_code != 200:
        logger.error("LLM error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def chat_completion_with_history(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    client = get_client()
    response = await _call_with_fallback(client, messages, temperature, max_tokens, model)
    if response.status_code != 200:
        logger.error("LLM error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def vision_completion(
    image_base64: str,
    prompt: str = "Identify the place or landmark in this photograph.",
    system: str = "",
    model: str = "llama-3.2-90b-vision-preview",
    temperature: float = 0.0,
    max_tokens: int = 300,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_base64}},
        ],
    })

    client = get_client()
    # Vision: try primary, fallback to OpenRouter vision model
    response = await _call_llm(
        client, settings.openrouter_base_url, settings.openrouter_api_key,
        model, messages, temperature, max_tokens,
    )
    if response.status_code == 429 and settings.fallback_api_key:
        logger.warning("Vision model rate-limited, falling back to OpenRouter")
        response = await _call_llm(
            client, settings.fallback_base_url, settings.fallback_api_key,
            "google/gemma-3-27b-it:free", messages, temperature, max_tokens,
        )
    if response.status_code != 200:
        logger.error("Vision LLM error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]
