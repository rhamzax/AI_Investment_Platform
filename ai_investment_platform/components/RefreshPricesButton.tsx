"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshPricesButton({ lastSynced }: { lastSynced: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_TRIGGER_API_URL}/prices/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      router.refresh();
    } catch {
      setError("Couldn't reach the trigger endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Refresh Prices"}
      </button>
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : lastSynced ? (
        <p className="text-xs text-ink-muted">
          Prices as of {new Date(lastSynced).toLocaleDateString()}
        </p>
      ) : null}
    </div>
  );
}
