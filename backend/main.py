import logging

import yfinance as yf
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.pipeline import generate_thesis
from db.client import get_client
from ingestion.base import ensure_ticker
from ingestion.daily_price import sync_daily_prices
from ingestion.validate import resolve_ticker

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Thesis Arena")

# Single-user demo — tighten this before onboarding real users.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate/{ticker}", status_code=202)
def trigger_generate(ticker: str, background_tasks: BackgroundTasks):
    """Kick off the Bull/Bear/Judge pipeline for a ticker.

    Runs in the background (ingestion + 3 LLM calls take a while) — the
    dashboard picks up the result via the Supabase Realtime subscription on
    `memos` rather than waiting on this request.
    """
    ticker = ticker.upper()
    background_tasks.add_task(generate_thesis, ticker)
    return {"status": "accepted", "ticker": ticker}


@app.get("/tickers/search")
def search_tickers(q: str):
    """Autocomplete for the Add Position ticker field, backed by Yahoo
    Finance's search — so users pick from real matches instead of typing an
    arbitrary symbol.
    """
    q = q.strip()
    if len(q) < 1:
        return {"results": []}

    try:
        quotes = yf.Search(q, max_results=8).quotes
    except Exception:
        logging.exception("Ticker search failed for query %r", q)
        return {"results": []}

    results = [
        {
            "ticker": quote["symbol"],
            "company_name": quote.get("longname") or quote.get("shortname") or quote["symbol"],
            "exchange": quote.get("exchDisp"),
        }
        for quote in quotes
        if quote.get("quoteType") == "EQUITY" and quote.get("symbol")
    ]
    return {"results": results}


class CreatePosition(BaseModel):
    ticker: str
    shares: float = Field(gt=0)
    cost_basis: float = Field(gt=0)


@app.post("/positions", status_code=201)
def create_position(body: CreatePosition):
    """Add a new position. Ticker is validated live via yfinance rather than
    a maintained exchange symbol list — works for any ticker yfinance covers
    (NASDAQ, NYSE, etc.), not NASDAQ-only.
    """
    ticker = body.ticker.strip().upper()
    is_valid, company_name = resolve_ticker(ticker)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Unknown ticker: {ticker!r}")

    ensure_ticker(ticker, company_name=company_name)
    row = (
        get_client()
        .table("positions")
        .insert({"ticker": ticker, "shares": body.shares, "cost_basis": body.cost_basis})
        .execute()
    )
    return row.data[0]


@app.post("/prices/sync")
def sync_prices():
    """Sync daily closes for every ticker currently held in `positions`."""
    tickers = {
        row["ticker"]
        for row in get_client().table("positions").select("ticker").execute().data
    }

    synced: dict[str, int] = {}
    for ticker in tickers:
        try:
            synced[ticker] = sync_daily_prices(ticker)
        except Exception:
            logging.exception("Price sync failed for %s", ticker)
            synced[ticker] = 0

    return {"synced": synced}
