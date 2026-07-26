export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="h-4 w-20 animate-pulse rounded bg-neutral-surface" />
      <div className="mt-2 h-8 w-32 animate-pulse rounded bg-neutral-surface" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-neutral-surface" />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-neutral-surface" />
        <div className="h-48 animate-pulse rounded-2xl bg-neutral-surface" />
      </div>
    </div>
  );
}
