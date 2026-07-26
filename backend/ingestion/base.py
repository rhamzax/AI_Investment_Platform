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
    """Ensure a row exists in `tickers`.

    Only writes company_name when a real one is given. Callers that don't
    have a name handy (most ingestion modules just need the FK satisfied)
    must NOT clobber a name another module already resolved. Plain upsert
    can't express "leave this column alone" when it's NOT NULL — Postgres
    validates the proposed insert row's NOT NULL constraints before it even
    checks for a conflict — so this does an explicit exists-check instead.
    """
    client = get_client()
    existing = client.table("tickers").select("ticker").eq("ticker", ticker).execute().data

    if not existing:
        client.table("tickers").insert(
            {"ticker": ticker, "company_name": company_name or ticker}
        ).execute()
    elif company_name:
        client.table("tickers").update({"company_name": company_name}).eq(
            "ticker", ticker
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
