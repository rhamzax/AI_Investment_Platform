import yfinance as yf

from ingestion.base import ensure_ticker
from db.client import get_client


def sync_daily_prices(ticker: str, period: str = "6mo") -> int:
    """Fetch daily closes for `ticker` and upsert them into daily_prices.

    Unlike raw_data_cache (one row per fetch, TTL-based), this table is a
    proper time series — re-syncing overwrites same-date rows via the
    (ticker, date) unique constraint rather than accumulating duplicates.
    """
    ensure_ticker(ticker)

    hist = yf.Ticker(ticker).history(period=period).dropna(subset=["Close"])
    rows = [
        {"ticker": ticker, "date": index.strftime("%Y-%m-%d"), "close": float(row["Close"])}
        for index, row in hist.iterrows()
    ]
    if not rows:
        return 0

    get_client().table("daily_prices").upsert(rows, on_conflict="ticker,date").execute()
    return len(rows)
