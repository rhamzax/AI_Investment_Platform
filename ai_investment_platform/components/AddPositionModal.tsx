"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TickerSearchInput, type TickerMatch } from "@/components/TickerSearchInput";

export function AddPositionModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TickerMatch | null>(null);
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setSelected(null);
    setShares("");
    setCostBasis("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Pick a ticker from the search results.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_TRIGGER_API_URL}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selected.ticker,
          shares: Number(shares),
          cost_basis: Number(costBasis),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed (${res.status})`);
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-card-hover"
      >
        + Add Position
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add position</h2>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                aria-label="Close"
                className="text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-ink-muted">Ticker</label>
                <TickerSearchInput selected={selected} onSelect={setSelected} />
              </div>
              <div>
                <label className="text-xs text-ink-muted" htmlFor="shares">
                  Shares
                </label>
                <input
                  id="shares"
                  type="number"
                  min="0"
                  step="any"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted" htmlFor="cost_basis">
                  Cost basis (per share)
                </label>
                <input
                  id="cost_basis"
                  type="number"
                  min="0"
                  step="any"
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {error ? <p className="text-xs text-critical">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !selected}
                className="w-full rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add position"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
