import json
from datetime import timedelta

import yfinance as yf

from ingestion.base import ensure_ticker, get_cached_or_fetch

SOURCE = "yfinance"
TTL = timedelta(hours=1)


def _price_history(tk: yf.Ticker) -> list[dict]:
    # dropna: yfinance can include a trailing row with NaN OHLC for the
    # current in-progress trading day, which isn't valid JSON.
    hist = tk.history(period="3mo").dropna(subset=["Open", "High", "Low", "Close"])
    return [
        {
            "date": index.strftime("%Y-%m-%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        }
        for index, row in hist.iterrows()
    ]


def _json_safe_records(df) -> list[dict]:
    return json.loads(df.to_json(orient="records", date_format="iso"))


def _json_safe(value):
    """yfinance's .info dict can contain raw NaN floats, which aren't valid
    JSON and break the Supabase insert."""
    if isinstance(value, float) and value != value:  # NaN
        return None
    return value


def _options_chain(tk: yf.Ticker) -> dict:
    expirations = tk.options
    if not expirations:
        return {}
    nearest = expirations[0]
    chain = tk.option_chain(nearest)
    return {
        "expiration": nearest,
        "calls": _json_safe_records(chain.calls),
        "puts": _json_safe_records(chain.puts),
    }


def fetch(ticker: str) -> dict:
    tk = yf.Ticker(ticker)
    info = tk.info or {}
    return {
        "price_history": _price_history(tk),
        "options_chain": _options_chain(tk),
        "info": {
            "company_name": _json_safe(info.get("longName") or info.get("shortName")),
            "sector": _json_safe(info.get("sector")),
            "market_cap": _json_safe(info.get("marketCap")),
            "pe_ratio": _json_safe(info.get("trailingPE")),
        },
    }


def get(ticker: str) -> dict:
    ensure_ticker(ticker)
    data = get_cached_or_fetch(ticker, SOURCE, TTL, lambda: fetch(ticker))
    info = data.get("info", {})
    if info.get("company_name"):
        ensure_ticker(ticker, company_name=info["company_name"])
    return data
