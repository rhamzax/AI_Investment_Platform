from datetime import date, timedelta

import requests

from ingestion.base import ensure_ticker, get_cached_or_fetch, require_env

SOURCE = "finnhub"
TTL = timedelta(hours=1)

_NEWS_URL = "https://finnhub.io/api/v1/company-news"
_SENTIMENT_URL = "https://finnhub.io/api/v1/news-sentiment"


def fetch(ticker: str) -> dict:
    api_key = require_env("FINNHUB_API_KEY")
    today = date.today()
    news_resp = requests.get(
        _NEWS_URL,
        params={
            "symbol": ticker,
            "from": (today - timedelta(days=14)).isoformat(),
            "to": today.isoformat(),
            "token": api_key,
        },
        timeout=30,
    )
    news_resp.raise_for_status()
    articles = [
        {
            "headline": item.get("headline"),
            "source": item.get("source"),
            "url": item.get("url"),
            "datetime": item.get("datetime"),
            "summary": item.get("summary"),
        }
        for item in news_resp.json()[:25]
    ]

    # news-sentiment is a premium-only Finnhub endpoint — degrade gracefully
    # on the free tier (403) rather than failing the whole source.
    sentiment_score = None
    buzz = None
    sentiment_resp = requests.get(
        _SENTIMENT_URL, params={"symbol": ticker, "token": api_key}, timeout=30
    )
    if sentiment_resp.status_code == 200:
        sentiment = sentiment_resp.json()
        sentiment_score = sentiment.get("sentiment", {}).get("bullishPercent")
        buzz = sentiment.get("buzz")

    return {
        "articles": articles,
        "sentiment_score": sentiment_score,
        "buzz": buzz,
    }


def get(ticker: str) -> dict:
    ensure_ticker(ticker)
    return get_cached_or_fetch(ticker, SOURCE, TTL, lambda: fetch(ticker))
