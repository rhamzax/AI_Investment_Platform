from datetime import timedelta

import requests

from ingestion.base import ensure_ticker, get_cached_or_fetch, require_env

SOURCE = "fred"
TTL = timedelta(days=1)

_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Macro series are ticker-independent — the same handful of series is stored
# under every ticker so the ingestion interface stays uniform across sources.
_SERIES = {
    "gdp": "GDP",
    "cpi": "CPIAUCSL",
    "fed_funds": "FEDFUNDS",
    "unemployment": "UNRATE",
}


def _fetch_series(series_id: str, api_key: str) -> list[dict]:
    resp = requests.get(
        _BASE_URL,
        params={
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": 12,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return [
        {"date": obs["date"], "value": obs["value"]}
        for obs in resp.json().get("observations", [])
    ]


def fetch(ticker: str) -> dict:
    api_key = require_env("FRED_API_KEY")
    return {
        "series": {
            name: _fetch_series(series_id, api_key)
            for name, series_id in _SERIES.items()
        }
    }


def get(ticker: str) -> dict:
    ensure_ticker(ticker)
    return get_cached_or_fetch(ticker, SOURCE, TTL, lambda: fetch(ticker))
