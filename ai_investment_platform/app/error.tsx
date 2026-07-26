"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-ink-secondary">
        {error.message || "Failed to load data from Supabase."}
      </p>
      <button
        onClick={() => unstable_retry()}
        className="mt-4 rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-card-hover"
      >
        Try again
      </button>
    </div>
  );
}
