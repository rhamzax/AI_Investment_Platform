"use client";

import { useEffect, useRef, useState } from "react";

import {
  fetchLatestMemoSince,
  fetchMemoWithTheses,
  type MemoWithTheses,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { Thesis, Verdict } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const VERDICT_STYLES: Record<Verdict, string> = {
  bullish: "bg-good-surface text-good",
  bearish: "bg-critical-surface text-critical",
  neutral: "bg-neutral-surface text-ink-secondary",
};

// Confidence is a magnitude, not a state — sequential blue, not status colors.
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#cde2fb] dark:bg-[#184f95]/40">
        <div
          className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-ink-muted">{pct}% confidence</span>
    </div>
  );
}

function ThesisCard({ stance, thesis }: { stance: "bull" | "bear"; thesis: Thesis | null }) {
  const label = stance === "bull" ? "Bull Case" : "Bear Case";
  const accent = stance === "bull" ? "bg-good" : "bg-critical";

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </h3>
      </div>
      {thesis ? (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
            {thesis.thesis}
          </p>
          {thesis.key_points && thesis.key_points.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-ink-secondary">
              {thesis.key_points.map((point, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${accent}`} />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Not available.</p>
      )}
    </div>
  );
}

export function TickerMemoView({
  ticker,
  initial,
}: {
  ticker: string;
  initial: MemoWithTheses | null;
}) {
  const [data, setData] = useState(initial);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    const fresh = await fetchMemoWithTheses(ticker);
    setData(fresh);
    setGenerating(false);
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }

  useEffect(() => {
    const channel = supabase
      .channel(`ticker-memos-${ticker}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "memos", filter: `ticker=eq.${ticker}` },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // Fallback in case the realtime event is missed for any reason — polls
  // Supabase directly until the new memo shows up, then stops.
  function pollForMemo(sinceISO: string, deadline: number) {
    pollTimer.current = setTimeout(async () => {
      const memo = await fetchLatestMemoSince(ticker, sinceISO);
      if (memo) {
        await refresh();
        return;
      }
      if (Date.now() < deadline) {
        pollForMemo(sinceISO, deadline);
      } else {
        setGenerating(false);
        setError("Taking longer than expected — check back shortly.");
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    const sinceISO = new Date().toISOString();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_TRIGGER_API_URL}/generate/${ticker}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      pollForMemo(sinceISO, Date.now() + POLL_TIMEOUT_MS);
    } catch {
      setGenerating(false);
      setError("Couldn't reach the trigger endpoint. Is it running?");
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {data ? (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${VERDICT_STYLES[data.memo.verdict]}`}
              >
                {data.memo.verdict}
              </span>
              {data.memo.confidence != null ? (
                <ConfidenceMeter confidence={data.memo.confidence} />
              ) : null}
            </div>
          ) : (
            <span className="text-sm text-ink-muted">No thesis generated yet.</span>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating…" : data ? "Regenerate Thesis" : "Generate Thesis"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-critical">{error}</p> : null}
        {data ? (
          <p className="mt-4 text-sm leading-6 text-ink-secondary">{data.memo.summary}</p>
        ) : null}
      </div>

      {data ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ThesisCard stance="bull" thesis={data.bull} />
          <ThesisCard stance="bear" thesis={data.bear} />
        </div>
      ) : null}
    </div>
  );
}
