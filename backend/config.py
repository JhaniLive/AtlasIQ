from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    default_model: str = "openai/gpt-4o-mini"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cache_ttl_seconds: int = 300

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
