import json
from pathlib import Path

from models.country import Country

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "countries.json"
_countries: list[Country] = []


def _load() -> list[Country]:
    global _countries
    if not _countries:
        raw = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
        _countries = [Country(**c) for c in raw]
    return _countries


def get_all() -> list[Country]:
    return _load()


def get_by_code(code: str) -> Country | None:
    code = code.upper()
    return next((c for c in _load() if c.code == code), None)
