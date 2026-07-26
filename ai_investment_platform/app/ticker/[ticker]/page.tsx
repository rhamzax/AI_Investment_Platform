import Link from "next/link";

import { TickerMemoView } from "@/components/TickerMemoView";
import { fetchCompanyNames, fetchMemoWithTheses } from "@/lib/queries";

export default async function TickerPage(props: PageProps<"/ticker/[ticker]">) {
  const { ticker: rawTicker } = await props.params;
  const ticker = rawTicker.toUpperCase();
  const [initial, companyNames] = await Promise.all([
    fetchMemoWithTheses(ticker),
    fetchCompanyNames([ticker]),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link href="/" className="text-xs text-ink-muted hover:underline">
        ← Holdings
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {ticker}
        {companyNames[ticker] ? (
          <span className="ml-2 text-lg font-normal text-ink-muted">
            {companyNames[ticker]}
          </span>
        ) : null}
      </h1>

      <div className="mt-6">
        <TickerMemoView ticker={ticker} initial={initial} />
      </div>
    </div>
  );
}
