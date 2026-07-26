"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { fetchLatestMemoSince } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { DailyPrice, Memo, Position, Verdict } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// bullish/bearish map to the fixed good/critical status colors; neutral is
// deliberately not "warning" (it isn't a warning state) — it gets a plain
// muted treatment instead.
const VERDICT_STYLES: Record<Verdict, string> = {
  bullish: "bg-good-surface text-good",
  bearish: "bg-critical-surface text-critical",
  neutral: "bg-neutral-surface text-ink-secondary",
};

function VerdictBadge({ memo }: { memo: Memo | null }) {
  if (!memo) {
    return (
      <span className="rounded-full bg-neutral-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
        No thesis yet
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${VERDICT_STYLES[memo.verdict]}`}
    >
      {memo.verdict}
      {memo.confidence != null ? ` · ${Math.round(memo.confidence * 100)}%` : ""}
    </span>
  );
}

function TickerAvatar({ ticker }: { ticker: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-surface text-sm font-semibold text-ink-secondary">
      {ticker.slice(0, 2)}
    </div>
  );
}

function ValueCell({ position, price }: { position: Position; price: DailyPrice | null }) {
  if (!price) {
    return <div className="min-w-28 text-right text-xs text-ink-muted">No price yet</div>;
  }
  const marketValue = position.shares * price.close;
  const costValue = position.shares * position.cost_basis;
  const gainPct = ((marketValue - costValue) / costValue) * 100;

  return (
    <div className="min-w-28 text-right">
      <p className="text-sm font-medium">
        ${marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
      <p className={`text-xs ${gainPct >= 0 ? "text-good" : "text-critical"}`}>
        {gainPct >= 0 ? "+" : ""}
        {gainPct.toFixed(1)}%
      </p>
    </div>
  );
}

export function PortfolioTable({
  positions,
  initialMemos,
  latestPrices,
  companyNames,
}: {
  positions: Position[];
  initialMemos: Record<string, Memo>;
  latestPrices: Record<string, DailyPrice>;
  companyNames: Record<string, string>;
}) {
  const [memos, setMemos] = useState(initialMemos);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function onMemoArrived(memo: Memo) {
    setMemos((prev) => ({ ...prev, [memo.ticker]: memo }));
    setGenerating((prev) => {
      const next = new Set(prev);
      next.delete(memo.ticker);
      return next;
    });
    clearTimeout(pollTimers.current[memo.ticker]);
    delete pollTimers.current[memo.ticker];
  }

  useEffect(() => {
    const channel = supabase
      .channel("portfolio-memos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "memos" },
        (payload) => onMemoArrived(payload.new as Memo),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(pollTimers.current).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback in case the realtime event is missed for any reason — polls
  // Supabase directly until the new memo shows up, then stops.
  function pollForMemo(ticker: string, sinceISO: string, deadline: number) {
    pollTimers.current[ticker] = setTimeout(async () => {
      const memo = await fetchLatestMemoSince(ticker, sinceISO);
      if (memo) {
        onMemoArrived(memo);
        return;
      }
      if (Date.now() < deadline) {
        pollForMemo(ticker, sinceISO, deadline);
      } else {
        setGenerating((prev) => {
          const next = new Set(prev);
          next.delete(ticker);
          return next;
        });
        setErrors((prev) => ({
          ...prev,
          [ticker]: "Taking longer than expected — check back shortly.",
        }));
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate(ticker: string) {
    setErrors((prev) => ({ ...prev, [ticker]: "" }));
    setGenerating((prev) => new Set(prev).add(ticker));
    const sinceISO = new Date().toISOString();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_TRIGGER_API_URL}/generate/${ticker}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      pollForMemo(ticker, sinceISO, Date.now() + POLL_TIMEOUT_MS);
    } catch {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
      setErrors((prev) => ({
        ...prev,
        [ticker]: "Couldn't reach the trigger endpoint. Is it running?",
      }));
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {positions.map((position, i) => {
        const memo = memos[position.ticker] ?? null;
        const isGenerating = generating.has(position.ticker);
        return (
          <div
            key={position.id}
            className={`flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-card-hover ${i > 0 ? "border-t border-line" : ""}`}
          >
            <TickerAvatar ticker={position.ticker} />

            <Link href={`/ticker/${position.ticker}`} className="min-w-32">
              <p className="text-sm font-semibold">{position.ticker}</p>
              <p className="truncate text-xs text-ink-muted">
                {companyNames[position.ticker] ?? position.ticker}
              </p>
              <p className="text-xs text-ink-muted">
                {position.shares} sh · ${position.cost_basis.toLocaleString()} avg
              </p>
            </Link>

            <div className="flex-1" />

            <ValueCell position={position} price={latestPrices[position.ticker] ?? null} />

            <VerdictBadge memo={memo} />

            <button
              onClick={() => handleGenerate(position.ticker)}
              disabled={isGenerating}
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate Thesis"}
            </button>

            {errors[position.ticker] ? (
              <p className="w-full text-xs text-critical">{errors[position.ticker]}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
