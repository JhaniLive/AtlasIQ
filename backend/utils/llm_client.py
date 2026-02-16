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


async def chat_completion(
    prompt: str,
    system: str = "",
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    model = model or settings.default_model
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    client = get_client()
    response = await client.post(
        f"{settings.openrouter_base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )
    if response.status_code != 200:
        logger.error("OpenRouter error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def chat_completion_with_history(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    model = model or settings.default_model
    client = get_client()
    response = await client.post(
        f"{settings.openrouter_base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )
    if response.status_code != 200:
        logger.error("OpenRouter error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def vision_completion(
    image_base64: str,
    prompt: str = "Identify the place or landmark in this photograph.",
    system: str = "",
    model: str = "openai/gpt-4o-mini",
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
    response = await client.post(
        f"{settings.openrouter_base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )
    if response.status_code != 200:
        logger.error("OpenRouter vision error %s: %s", response.status_code, response.text)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]
