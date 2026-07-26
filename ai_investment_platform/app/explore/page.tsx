import Link from "next/link";

import { fetchTopMemosByConfidence } from "@/lib/queries";
import type { Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICT_STYLES: Record<Verdict, string> = {
  bullish: "bg-good-surface text-good",
  bearish: "bg-critical-surface text-critical",
  neutral: "bg-neutral-surface text-ink-secondary",
};

export default async function ExplorePage() {
  const rankings = await fetchTopMemosByConfidence(20);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Every researched ticker, ranked by how confident the Judge Agent was in its verdict.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
        {rankings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">
            No theses generated yet — generate one from the Holdings page.
          </p>
        ) : (
          rankings.map((memo, i) => (
            <Link
              key={memo.id}
              href={`/ticker/${memo.ticker}`}
              className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-card-hover ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="w-6 text-sm font-medium text-ink-muted">{i + 1}</span>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-surface text-sm font-semibold text-ink-secondary">
                {memo.ticker.slice(0, 2)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{memo.ticker}</p>
                <p className="truncate text-xs text-ink-muted">{memo.company_name}</p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${VERDICT_STYLES[memo.verdict]}`}
              >
                {memo.verdict}
              </span>

              <span className="w-16 text-right text-sm font-semibold">
                {memo.confidence != null ? `${Math.round(memo.confidence * 100)}%` : "—"}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
