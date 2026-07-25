import time
from datetime import timedelta

import requests

from ingestion.base import ensure_ticker, get_cached_or_fetch, require_env

SOURCE = "alpha_vantage"
TTL = timedelta(days=1)

_BASE_URL = "https://www.alphavantage.co/query"


def _request(function: str, ticker: str, api_key: str) -> dict:
    resp = requests.get(
        _BASE_URL,
        params={"function": function, "symbol": ticker, "apikey": api_key},
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()

    if not payload or "Information" in payload or "Note" in payload or "Error Message" in payload:
        # Alpha Vantage returns 200 with an "Information"/"Note"/"Error Message"
        # body for rate limits or premium-only endpoints instead of an HTTP error.
        message = (
            payload.get("Information")
            or payload.get("Note")
            or payload.get("Error Message")
            or payload
        )
        raise RuntimeError(
            f"Alpha Vantage {function} request failed for {ticker!r}: {message}"
        )

    return payload


def fetch(ticker: str) -> dict:
    api_key = require_env("ALPHA_VANTAGE_API_KEY")

    overview = _request("OVERVIEW", ticker, api_key)
    time.sleep(1)  # free tier is rate-limited to 1 request/second
    earnings = _request("EARNINGS", ticker, api_key)

    return {
        "overview": {
            "name": overview.get("Name"),
            "description": overview.get("Description"),
            "sector": overview.get("Sector"),
            "industry": overview.get("Industry"),
            "market_cap": overview.get("MarketCapitalization"),
            "pe_ratio": overview.get("PERatio"),
            "peg_ratio": overview.get("PEGRatio"),
            "eps": overview.get("EPS"),
            "profit_margin": overview.get("ProfitMargin"),
            "revenue_ttm": overview.get("RevenueTTM"),
            "dividend_yield": overview.get("DividendYield"),
            "52_week_high": overview.get("52WeekHigh"),
            "52_week_low": overview.get("52WeekLow"),
        },
        "annual_earnings": earnings.get("annualEarnings", [])[:5],
        "quarterly_earnings": earnings.get("quarterlyEarnings", [])[:8],
    }


def get(ticker: str) -> dict:
    ensure_ticker(ticker)
    return get_cached_or_fetch(ticker, SOURCE, TTL, lambda: fetch(ticker))
