-- AI Investment Research Platform — Supabase schema
-- Run in the Supabase SQL editor (or via `supabase db push`) against a fresh project.
-- Single-user demo: RLS is enabled everywhere but policies are permissive (allow all).
-- Tighten policies (scope to auth.uid()) before onboarding real users.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- tickers: parent table — single source of truth for what a valid ticker is.
-- Every other table FKs into this instead of storing free-text ticker
-- strings, so a typo can't silently create orphaned/inconsistent rows.
-- Ingestion/agent code should upsert here before writing to the tables below.
-- ---------------------------------------------------------------------------
create table if not exists tickers (
    ticker text primary key,
    company_name text not null,
    sector text,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- positions: manually-entered portfolio holdings, shown in the dashboard
-- ---------------------------------------------------------------------------
create table if not exists positions (
    id uuid primary key default gen_random_uuid(),
    ticker text not null references tickers (ticker),
    shares numeric not null,
    cost_basis numeric not null,
    opened_at date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists positions_ticker_idx on positions (ticker);

-- ---------------------------------------------------------------------------
-- raw_data_cache: normalized responses from each ingestion source, keyed by
-- ticker + source, so agents and re-runs don't re-hit rate-limited APIs.
-- One row per fetch — multiple rows accumulate per ticker/source over time.
-- ---------------------------------------------------------------------------
create table if not exists raw_data_cache (
    id uuid primary key default gen_random_uuid(),
    ticker text not null references tickers (ticker),
    source text not null check (
        source in ('sec_edgar', 'fred', 'yfinance', 'finnhub', 'alpha_vantage')
    ),
    data jsonb not null,
    fetched_at timestamptz not null default now()
);

create index if not exists raw_data_cache_ticker_source_idx
    on raw_data_cache (ticker, source, fetched_at desc);

-- ---------------------------------------------------------------------------
-- theses: intermediate output from the Bull and Bear agents for a given run.
-- One row per stance, tied together by run_id — a single run produces two
-- rows here (one bull, one bear).
-- ---------------------------------------------------------------------------
create table if not exists theses (
    id uuid primary key default gen_random_uuid(),
    ticker text not null references tickers (ticker),
    run_id uuid not null default gen_random_uuid(),
    stance text not null check (stance in ('bull', 'bear')),
    thesis text not null,
    key_points jsonb,
    sources jsonb, -- which raw_data_cache rows/sources were used
    created_at timestamptz not null default now()
);

create index if not exists theses_run_id_idx on theses (run_id);
create index if not exists theses_ticker_idx on theses (ticker);

-- ---------------------------------------------------------------------------
-- memos: final Judge Agent output — what the dashboard's memo view renders
-- ---------------------------------------------------------------------------
create table if not exists memos (
    id uuid primary key default gen_random_uuid(),
    ticker text not null references tickers (ticker),
    run_id uuid not null,
    verdict text not null check (verdict in ('bullish', 'bearish', 'neutral')),
    confidence numeric check (confidence >= 0 and confidence <= 1),
    summary text not null,
    bull_thesis_id uuid references theses (id),
    bear_thesis_id uuid references theses (id),
    created_at timestamptz not null default now()
);

create index if not exists memos_ticker_idx on memos (ticker);
create index if not exists memos_run_id_idx on memos (run_id);

-- ---------------------------------------------------------------------------
-- daily_prices: end-of-day close per ticker, used to chart portfolio value
-- over time and compute current market value vs. cost basis. One row per
-- ticker/date — populated by POST /prices/sync (ingestion/daily_price.py),
-- not by the agent pipeline.
-- ---------------------------------------------------------------------------
create table if not exists daily_prices (
    id uuid primary key default gen_random_uuid(),
    ticker text not null references tickers (ticker),
    date date not null,
    close numeric not null,
    created_at timestamptz not null default now(),
    unique (ticker, date)
);

create index if not exists daily_prices_ticker_date_idx
    on daily_prices (ticker, date desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for positions
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists positions_set_updated_at on positions;
create trigger positions_set_updated_at
    before update on positions
    for each row
    execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled but permissive (single-user demo).
-- Anon/auth roles can do everything. Before real users: scope each policy to
-- `auth.uid() = user_id` after adding a user_id column to each table.
-- ---------------------------------------------------------------------------
alter table tickers enable row level security;
alter table positions enable row level security;
alter table raw_data_cache enable row level security;
alter table theses enable row level security;
alter table memos enable row level security;
alter table daily_prices enable row level security;

create policy "allow all - tickers" on tickers
    for all using (true) with check (true);

create policy "allow all - positions" on positions
    for all using (true) with check (true);

create policy "allow all - raw_data_cache" on raw_data_cache
    for all using (true) with check (true);

create policy "allow all - theses" on theses
    for all using (true) with check (true);

create policy "allow all - memos" on memos
    for all using (true) with check (true);

create policy "allow all - daily_prices" on daily_prices
    for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime — dashboard subscribes to memos so new verdicts appear live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table memos;
