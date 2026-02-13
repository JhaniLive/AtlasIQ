import time
from typing import Any

from config import settings


class TTLCache:
    def __init__(self, ttl: int | None = None):
        self._store: dict[str, tuple[Any, float]] = {}
        self._ttl = ttl or settings.cache_ttl_seconds

    def get(self, key: str) -> Any | None:
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < self._ttl:
                return value
            del self._store[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.time())

    def clear(self) -> None:
        self._store.clear()


cache = TTLCache()
