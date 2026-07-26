"use client";

import { useEffect, useRef, useState } from "react";

export type TickerMatch = {
  ticker: string;
  company_name: string;
  exchange: string | null;
};

export function TickerSearchInput({
  selected,
  onSelect,
}: {
  selected: TickerMatch | null;
  onSelect: (match: TickerMatch | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected || query.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_TRIGGER_API_URL}/tickers/search?q=${encodeURIComponent(query)}`,
        );
        const body = await res.json();
        setResults(body.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="mt-1 flex items-center justify-between rounded-lg border border-line bg-page px-3 py-2 text-sm">
          <span>
            <span className="font-semibold">{selected.ticker}</span>{" "}
            <span className="text-ink-muted">{selected.company_name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            aria-label="Clear ticker"
            className="text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search company or ticker…"
          autoComplete="off"
          required
          className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      {open && !selected ? (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-ink-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">
              {query.trim().length > 0 ? "No matches." : "Start typing a company or ticker."}
            </p>
          ) : (
            results.map((match) => (
              <button
                type="button"
                key={match.ticker}
                onClick={() => {
                  onSelect(match);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-card-hover"
              >
                <span>
                  <span className="font-semibold">{match.ticker}</span>{" "}
                  <span className="text-ink-muted">{match.company_name}</span>
                </span>
                {match.exchange ? (
                  <span className="text-xs text-ink-muted">{match.exchange}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
