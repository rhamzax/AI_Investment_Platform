import os
from datetime import datetime, timedelta, timezone
from typing import Callable

from db.client import get_client


class MissingAPIKeyError(RuntimeError):
    pass


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise MissingAPIKeyError(f"Missing required environment variable: {name}")
    return value


def ensure_ticker(ticker: str, company_name: str | None = None) -> None:
    client = get_client()
    client.table("tickers").upsert(
        {"ticker": ticker, "company_name": company_name or ticker},
        on_conflict="ticker",
    ).execute()


def get_cached_or_fetch(
    ticker: str,
    source: str,
    ttl: timedelta,
    fetch_fn: Callable[[], dict],
) -> dict:
    client = get_client()
    cutoff = (datetime.now(timezone.utc) - ttl).isoformat()

    cached = (
        client.table("raw_data_cache")
        .select("data, fetched_at")
        .eq("ticker", ticker)
        .eq("source", source)
        .gte("fetched_at", cutoff)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    if cached.data:
        return cached.data[0]["data"]

    data = fetch_fn()
    client.table("raw_data_cache").insert(
        {"ticker": ticker, "source": source, "data": data}
    ).execute()
    return data
