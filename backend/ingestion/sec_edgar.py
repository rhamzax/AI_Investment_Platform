from datetime import timedelta

import requests

from ingestion.base import ensure_ticker, get_cached_or_fetch, require_env

SOURCE = "sec_edgar"
TTL = timedelta(days=1)

_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:0>10}.json"

_ticker_to_cik: dict[str, str] | None = None


def _headers() -> dict[str, str]:
    return {"User-Agent": require_env("SEC_EDGAR_USER_AGENT")}


def _load_ticker_map() -> dict[str, str]:
    global _ticker_to_cik
    if _ticker_to_cik is None:
        resp = requests.get(_TICKER_MAP_URL, headers=_headers(), timeout=30)
        resp.raise_for_status()
        _ticker_to_cik = {
            row["ticker"].upper(): str(row["cik_str"])
            for row in resp.json().values()
        }
    return _ticker_to_cik


def _cik_for(ticker: str) -> str:
    cik = _load_ticker_map().get(ticker.upper())
    if cik is None:
        raise ValueError(f"No SEC CIK found for ticker {ticker!r}")
    return cik


def fetch(ticker: str) -> dict:
    cik = _cik_for(ticker)
    resp = requests.get(
        _SUBMISSIONS_URL.format(cik=cik), headers=_headers(), timeout=30
    )
    resp.raise_for_status()
    payload = resp.json()

    recent = payload.get("filings", {}).get("recent", {})
    filings = [
        {
            "form": form,
            "filed_at": filed_at,
            "accession_number": accession,
            "primary_doc_url": (
                f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
                f"{accession.replace('-', '')}/{primary_doc}"
            ),
        }
        for form, filed_at, accession, primary_doc in zip(
            recent.get("form", []),
            recent.get("filingDate", []),
            recent.get("accessionNumber", []),
            recent.get("primaryDocument", []),
        )
        if form in ("10-K", "8-K")
    ][:20]

    return {"cik": cik, "filings": filings}


def get(ticker: str) -> dict:
    ensure_ticker(ticker)
    return get_cached_or_fetch(ticker, SOURCE, TTL, lambda: fetch(ticker))
