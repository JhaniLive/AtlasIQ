import json

from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    default_model: str = "openai/gpt-4o-mini"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cache_ttl_seconds: int = 300

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Accept JSON array or comma-separated string
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
