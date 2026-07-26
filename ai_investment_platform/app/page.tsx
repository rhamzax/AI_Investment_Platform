import { AddPositionModal } from "@/components/AddPositionModal";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PortfolioTable } from "@/components/PortfolioTable";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { StatTile } from "@/components/StatTile";
import {
  buildPortfolioSeries,
  fetchCompanyNames,
  fetchDailyPrices,
  latestPriceByTicker,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { Memo, Position } from "@/lib/types";

// Positions/memos/prices change on every action — never serve a
// build-time-cached snapshot.
export const dynamic = "force-dynamic";

async function getPositions(): Promise<Position[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("ticker");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getLatestMemos(tickers: string[]): Promise<Record<string, Memo>> {
  if (tickers.length === 0) return {};
  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .in("ticker", tickers)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const latest: Record<string, Memo> = {};
  for (const memo of data ?? []) {
    if (!latest[memo.ticker]) latest[memo.ticker] = memo;
  }
  return latest;
}

export default async function PortfolioPage() {
  const positions = await getPositions();
  const tickers = positions.map((p) => p.ticker);
  const [memos, prices, companyNames] = await Promise.all([
    getLatestMemos(tickers),
    fetchDailyPrices(tickers),
    fetchCompanyNames(tickers),
  ]);

  const latestPrices = latestPriceByTicker(prices);
  const series = buildPortfolioSeries(positions, prices);

  const totalCostBasis = positions.reduce(
    (sum, p) => sum + p.shares * p.cost_basis,
    0,
  );
  const totalMarketValue = positions.reduce((sum, p) => {
    const price = latestPrices[p.ticker];
    return sum + p.shares * (price ? price.close : p.cost_basis);
  }, 0);
  const withThesis = Object.keys(memos).length;
  const lastSynced = Object.values(latestPrices).sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0]?.date ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Bull vs. Bear investment theses, generated on demand.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshPricesButton lastSynced={lastSynced} />
          <AddPositionModal />
        </div>
      </div>

      {positions.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Market value"
            value={`$${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <StatTile
            label="Total cost basis"
            value={`$${totalCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <StatTile label="Positions" value={String(positions.length)} />
          <StatTile
            label="Theses generated"
            value={`${withThesis} / ${positions.length}`}
          />
        </div>
      ) : null}

      {positions.length > 0 ? (
        <div className="mt-6">
          <PortfolioChart points={series} />
        </div>
      ) : null}

      <div className="mt-6">
        {positions.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No positions yet — click &ldquo;Add Position&rdquo; to get started.
          </p>
        ) : (
          <PortfolioTable
            positions={positions}
            initialMemos={memos}
            latestPrices={latestPrices}
            companyNames={companyNames}
          />
        )}
      </div>
    </div>
  );
}
