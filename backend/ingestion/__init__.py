import logging

from ingestion import fred, fundamentals, market_data, news_sentiment, sec_edgar

logger = logging.getLogger(__name__)

_SOURCES = {
    "sec_edgar": sec_edgar,
    "fred": fred,
    "yfinance": market_data,
    "finnhub": news_sentiment,
    "alpha_vantage": fundamentals,
}


def fetch_all(ticker: str) -> dict[str, dict | None]:
    results: dict[str, dict | None] = {}
    for name, module in _SOURCES.items():
        try:
            results[name] = module.get(ticker)
        except Exception:
            logger.exception("Ingestion failed for source=%s ticker=%s", name, ticker)
            results[name] = None
    return results
