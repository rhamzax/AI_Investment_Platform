# Thesis Arena

An AI investment research platform: for each ticker in your portfolio, a
LangGraph pipeline runs a **Bull agent** and a **Bear agent** against live
market/fundamentals/filings/macro/news data, then a **Judge agent** weighs
both arguments and produces a verdict (bullish/bearish/neutral) with a
confidence score. The Next.js dashboard shows your holdings, portfolio value
over time, and lets you drill into any ticker's bull/bear case side by side.

## Repo layout

```
backend/                Python — ingestion, LangGraph agents, FastAPI trigger endpoint
  db/
    schema.sql           Supabase schema (source of truth)
    client.py             Supabase client (service-role key, server-side only)
  ingestion/              One module per data source + shared cache/validation helpers
  agents/                 Bull/Bear/Judge LangGraph pipeline
  main.py                 FastAPI app — the only way the frontend mutates data
ai_investment_platform/  Next.js — dashboard (reads Supabase directly, writes via FastAPI)
```

## Architecture at a glance

```
┌─────────────────────┐        reads (Supabase client, publishable key)
│   Next.js frontend   │ ───────────────────────────────────────┐
│  (Server + Client    │                                         │
│   Components)        │        writes/mutations                │
└──────────┬────────────┘ ────────────┐                         │
           │ POST /generate/:ticker    │                         ▼
           │ POST /positions           │                 ┌───────────────┐
           │ POST /prices/sync         │                 │   Supabase    │
           │ GET  /tickers/search      ▼                 │   (Postgres +  │
           │                   ┌───────────────┐         │  REST + Auth + │
           └──────────────────▶│  FastAPI       │────────▶│  Realtime)     │
                               │  (backend/)    │  writes │               │
                               └───────┬────────┘         └───────▲───────┘
                                       │                          │
                         ┌─────────────┴─────────────┐            │ Realtime
                         ▼                            ▼            │ (postgres_changes
                ┌─────────────────┐          ┌────────────────┐   │  on `memos`)
                │ ingestion/       │          │ agents/         │   │
                │ (5 data sources  │          │ (LangGraph:     │   │
                │  + yfinance      │◀─────────│  Bull → Bear →  │───┘
                │  search/validate)│  raw_data│  Judge)         │
                └─────────────────┘          └────────┬────────┘
                                                        │ calls
                                                        ▼
                                              Gemini / Anthropic / Kimi
                                              (swappable, agents/llm.py)
```

The frontend **never talks to an LLM or any external data API directly** —
it only ever talks to Supabase (for reads) and FastAPI (for anything that
needs Python: LLM calls, yfinance, ticker validation).

## Supabase: how each table gets written

The schema (`backend/db/schema.sql`) has 6 tables. `tickers` is the parent
every other table foreign-keys into, so a typo can't create orphaned rows.

| Table | Written by | When |
|---|---|---|
| `tickers` | `ingestion/base.py::ensure_ticker()` | Any ingestion call, `POST /positions`, or the agent pipeline. Only ever sets `company_name` when a real one is available — a bare call from a module that doesn't have a name (most of them) leaves an existing name untouched instead of overwriting it with the raw ticker symbol. |
| `positions` | `POST /positions` (FastAPI) | User adds a holding via the "Add Position" modal |
| `raw_data_cache` | `ingestion/base.py::get_cached_or_fetch()` | Every ingestion source call, gated by a per-source TTL (1h for yfinance/Finnhub, 1 day for SEC/FRED/Alpha Vantage) so repeated `generate_thesis` runs don't re-hit rate-limited APIs. One row per actual fetch — old rows aren't deleted, so it doubles as an audit trail. |
| `theses` | `agents/bull.py`, `agents/bear.py` | Each LangGraph run inserts exactly 2 rows (`stance='bull'` and `stance='bear'`) sharing one `run_id` |
| `memos` | `agents/judge.py` | One row per run — the Judge's verdict, confidence, summary, and FKs to the two `theses` rows it weighed |
| `daily_prices` | `ingestion/daily_price.py::sync_daily_prices()`, called from `POST /prices/sync` | User clicks "Refresh Prices". Upserts on `(ticker, date)`, so re-syncing overwrites same-day rows instead of duplicating — unlike `raw_data_cache`, this is a proper time series, not a fetch log |

**Row Level Security** is enabled on every table but every policy is
`USING (true) WITH CHECK (true)` — permissive, because this is a
single-user demo. Reads happen with the Supabase **publishable** key
(safe in the browser); the FastAPI backend uses the **secret** key
(`db/client.py`) for writes, which is why all mutations are proxied
through it rather than done directly from the frontend.

**Realtime** is enabled on `memos` only
(`alter publication supabase_realtime add table memos`). The frontend
subscribes to `postgres_changes` (`INSERT` on `memos`) so a verdict
appears the instant the Judge agent writes it — no polling required in
the common case. As a fallback (see below), the frontend also polls
directly in case a websocket event is ever missed.

## Backend: FastAPI endpoints (`backend/main.py`)

The frontend calls these via `NEXT_PUBLIC_TRIGGER_API_URL` (defaults to
`http://localhost:8000` in dev). CORS is wide open (`allow_origins=["*"]`) —
fine for a local demo, tighten before deploying.

| Endpoint | Method | Called from | What it does |
|---|---|---|---|
| `/health` | GET | — | Liveness check |
| `/generate/{ticker}` | POST | "Generate Thesis" / "Regenerate Thesis" buttons | Runs `generate_thesis(ticker)` as a `BackgroundTasks` job and returns `202` immediately — ingestion + 3 sequential LLM calls take too long to hold a request open for. The frontend doesn't wait on the response; it finds out the result landed via Realtime/polling on `memos`. |
| `/positions` | POST | "Add Position" modal | Body `{ticker, shares, cost_basis}`. Validates the ticker is real via a live yfinance lookup (`ingestion/validate.py`), upserts it into `tickers` with its real company name, then inserts the `positions` row. Returns `400` for an unresolvable ticker. |
| `/prices/sync` | POST | "Refresh Prices" button | For every distinct ticker in `positions`, pulls ~6 months of daily closes from yfinance and upserts them into `daily_prices`. Runs synchronously (a few seconds for a handful of tickers) since it's an explicit, infrequent user action. |
| `/tickers/search` | GET | Ticker autocomplete in "Add Position" | Query param `q`. Wraps `yfinance.Search` (Yahoo Finance's own search) so the modal only lets you pick a real equity match instead of typing an arbitrary symbol. |

## Backend: ingestion layer (`backend/ingestion/`)

One module per data source, sharing a common interface via
`ingestion/base.py`:

- `sec_edgar.py` — resolves ticker → CIK against EDGAR's public mapping, pulls recent 10-K/8-K filings
- `fred.py` — GDP, CPI, Fed funds rate, unemployment (macro context, same handful of series regardless of ticker)
- `market_data.py` (yfinance) — price history, options chain snapshot, company info
- `news_sentiment.py` (Finnhub) — recent company news + sentiment score
- `fundamentals.py` (Alpha Vantage) — company overview + earnings history
- `validate.py` — lenient ticker validation (`resolve_ticker`) used by `POST /positions`
- `daily_price.py` — the `daily_prices` sync used by `POST /prices/sync`

Every source module exposes `get(ticker)`, which goes through
`get_cached_or_fetch()` (TTL-gated cache read/write against
`raw_data_cache`). `ingestion/__init__.py::fetch_all(ticker)` calls all 5
research sources and catches per-source exceptions, so one API being down
(rate-limited, ticker not covered, etc.) doesn't block the other 4 — a
`None` just shows up for that source in the pipeline's input.

## Backend: agent pipeline (`backend/agents/`)

LangGraph state machine: `START → bull → bear → judge → END`
(`agents/graph.py`). Entry point is `agents/pipeline.py::generate_thesis(ticker)`:

1. `fetch_all(ticker)` — gathers the 5-source research dict
2. Builds the initial `ThesisState` (`ticker`, a fresh `run_id`, `raw_data`)
3. Invokes the compiled graph:
   - **`bull_node`** — argues the strongest bull case from `raw_data`, via structured LLM output (`schemas.BullBearOutput`), inserts a `theses` row
   - **`bear_node`** — mirror of bull, opposite stance
   - **`judge_node`** — sees *only* the two thesis texts (not raw_data — it adjudicates, it doesn't re-research), produces `schemas.JudgeOutput` (verdict/confidence/summary), inserts the `memos` row referencing both thesis IDs

The model is provider-agnostic (`agents/llm.py::get_agent_llm()`) — swapping
Gemini/Anthropic/Kimi is a one-line change there, since every node calls
`get_agent_llm()` rather than importing a provider SDK directly.

## Frontend: pages and what they read

All reads go straight through the Supabase JS client (`lib/supabase.ts`,
publishable key) from Server Components — no backend round-trip for data
that's just being displayed.

- **`/` (Holdings)** — `app/page.tsx`. Reads `positions`, latest `memos` per ticker, `daily_prices`, and `tickers.company_name`. Renders stat tiles (market value, cost basis, position count, thesis coverage), the `PortfolioChart` (value over time), and `PortfolioTable` (per-position row: value, gain/loss, verdict badge, Generate Thesis button).
- **`/ticker/[ticker]`** — the memo view. Reads the latest `memos` row for that ticker plus its two `theses` rows (`lib/queries.ts::fetchMemoWithTheses`). Shows verdict, confidence meter, summary, and bull/bear cards side by side.
- **`/explore`** — ranks every ticker ever researched (not just current holdings) by Judge confidence, latest memo per ticker, joined with `tickers.company_name`.

Both `/` and `/ticker/[ticker]` are `force-dynamic` (never statically
cached at build time — this data changes on every action) and have their
own `loading.tsx` skeletons.

### Live updates without a refresh

`PortfolioTable` and `TickerMemoView` both:
1. Subscribe to Supabase Realtime (`postgres_changes` on `memos`) — the fast path
2. Also start a **polling fallback** after triggering `/generate/:ticker` (checks every 3s, up to 3 minutes) in case the websocket event is ever missed, and surface a friendly error if generation is still not done after the timeout instead of spinning forever

### Where mutations go

Every write action goes through FastAPI, never directly to Supabase from
the browser:

- `AddPositionModal` → `TickerSearchInput` (autocomplete via `GET /tickers/search`) → `POST /positions`
- `PortfolioTable` / `TickerMemoView` "Generate Thesis" buttons → `POST /generate/:ticker`
- `RefreshPricesButton` → `POST /prices/sync`

## Environment variables

**`backend/.env`** (see `backend/.env.example`):
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DATABASE_PASSWORD` (used
for direct Postgres/DDL access when evolving the schema), `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, `FRED_API_KEY`, `FINNHUB_API_KEY`, `ALPHA_VANTAGE_API_KEY`,
`SEC_EDGAR_USER_AGENT`.

**`ai_investment_platform/.env.local`**:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_TRIGGER_API_URL` (the FastAPI base URL).

## Running locally

```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend (separate terminal)
cd ai_investment_platform
npm install
npm run dev
```

Dashboard at `http://localhost:3000`, API at `http://localhost:8000`.
