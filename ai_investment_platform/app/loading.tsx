export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="h-7 w-40 animate-pulse rounded bg-neutral-surface" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-2xl bg-neutral-surface" />
        <div className="h-20 animate-pulse rounded-2xl bg-neutral-surface" />
        <div className="h-20 animate-pulse rounded-2xl bg-neutral-surface" />
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-neutral-surface" />
    </div>
  );
}
