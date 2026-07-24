# Backend — data ingestion + agent pipeline

Python side of the AI Investment Research Platform: ingestion scripts, the
LangGraph Bull -> Bear -> Judge pipeline, and the trigger endpoint. Talks to
Supabase (Postgres + REST + Realtime) as its only datastore.

## Setup

1. Create a Supabase project at https://supabase.com/dashboard.
2. In the SQL editor, run [`db/schema.sql`](db/schema.sql). This creates
   `positions`, `raw_data_cache`, `theses`, `memos`, enables RLS with
   permissive single-user policies, and turns on Realtime for `memos`.
3. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings -> API
   - `ANTHROPIC_API_KEY`
   - API keys for FRED, Finnhub, Alpha Vantage, and a `SEC_EDGAR_USER_AGENT`
4. Create and activate the virtualenv:

   ```bash
   python3.13 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

5. Sanity-check the Supabase connection:

   ```bash
   python -c "from db.client import get_client; print(get_client().table('positions').select('*').execute())"
   ```

## Layout

- `db/` — Supabase client (`client.py`) and schema (`schema.sql`)
- `ingestion/` — one module per data source, normalizes into `raw_data_cache`
- `agents/` — LangGraph nodes: Bull Agent, Bear Agent, Judge Agent
