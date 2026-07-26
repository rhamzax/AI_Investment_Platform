import { supabase } from "@/lib/supabase";
import type { DailyPrice, Memo, Position, Thesis } from "@/lib/types";

export type MemoWithTheses = {
  memo: Memo;
  bull: Thesis | null;
  bear: Thesis | null;
};

export async function fetchMemoWithTheses(
  ticker: string,
): Promise<MemoWithTheses | null> {
  const { data: memo } = await supabase
    .from("memos")
    .select("*")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!memo) return null;

  const ids = [memo.bull_thesis_id, memo.bear_thesis_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: theses } = await supabase.from("theses").select("*").in("id", ids);

  return {
    memo,
    bull: theses?.find((t) => t.stance === "bull") ?? null,
    bear: theses?.find((t) => t.stance === "bear") ?? null,
  };
}

export async function fetchDailyPrices(tickers: string[]): Promise<DailyPrice[]> {
  if (tickers.length === 0) return [];
  const { data, error } = await supabase
    .from("daily_prices")
    .select("*")
    .in("ticker", tickers)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function latestPriceByTicker(prices: DailyPrice[]): Record<string, DailyPrice> {
  const latest: Record<string, DailyPrice> = {};
  for (const price of prices) {
    // prices is ascending by date, so the last write per ticker is the latest
    latest[price.ticker] = price;
  }
  return latest;
}

export async function fetchCompanyNames(
  tickers: string[],
): Promise<Record<string, string>> {
  if (tickers.length === 0) return {};
  const { data, error } = await supabase
    .from("tickers")
    .select("ticker, company_name")
    .in("ticker", tickers);
  if (error) throw new Error(error.message);

  const names: Record<string, string> = {};
  for (const row of data ?? []) names[row.ticker] = row.company_name;
  return names;
}

export type RankedMemo = Memo & { company_name: string };

// Latest memo per ticker, across every ticker ever researched (not just
// current positions), ranked by confidence — this is what /explore shows.
export async function fetchTopMemosByConfidence(limit = 20): Promise<RankedMemo[]> {
  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const latestByTicker = new Map<string, Memo>();
  for (const memo of data ?? []) {
    if (!latestByTicker.has(memo.ticker)) latestByTicker.set(memo.ticker, memo);
  }

  const ranked = [...latestByTicker.values()]
    .filter((m) => m.confidence != null)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, limit);

  const names = await fetchCompanyNames(ranked.map((m) => m.ticker));
  return ranked.map((memo) => ({ ...memo, company_name: names[memo.ticker] ?? memo.ticker }));
}

// Fallback for the realtime subscription: check whether a memo newer than
// `sinceISO` has landed for `ticker` yet. Used to poll after triggering
// "Generate Thesis" so the UI updates even if the websocket event is missed.
export async function fetchLatestMemoSince(
  ticker: string,
  sinceISO: string,
): Promise<Memo | null> {
  const { data } = await supabase
    .from("memos")
    .select("*")
    .eq("ticker", ticker)
    .gt("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export type PortfolioPoint = { date: string; value: number };

// Sums shares * close per date, across whichever tickers have a price row on
// that date. A date only some tickers have priced yet still shows a (partial)
// total rather than being dropped — the simplification to be aware of when
// reading gaps in the series right after a new position is added.
export function buildPortfolioSeries(
  positions: Position[],
  prices: DailyPrice[],
): PortfolioPoint[] {
  const sharesByTicker = new Map(positions.map((p) => [p.ticker, p.shares]));
  const byDate = new Map<string, number>();

  for (const price of prices) {
    const shares = sharesByTicker.get(price.ticker);
    if (!shares) continue;
    byDate.set(price.date, (byDate.get(price.date) ?? 0) + shares * price.close);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
