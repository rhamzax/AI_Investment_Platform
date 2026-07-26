"use client";

import { useMemo, useRef, useState } from "react";

import type { PortfolioPoint } from "@/lib/queries";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

function formatValue(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PortfolioChart({ points }: { points: PortfolioPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { path, xForIndex, yForValue, gridlines } = useMemo(() => {
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const xForIndex = (i: number) =>
      PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerWidth);
    const yForValue = (v: number) =>
      PAD_TOP + innerHeight - ((v - min) / span) * innerHeight;

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i)} ${yForValue(p.value)}`)
      .join(" ");

    const gridlines = [min, min + span / 2, max];

    return { path, xForIndex, yForValue, min, max, gridlines };
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="flex h-55 items-center justify-center rounded-2xl border border-line bg-card text-sm text-ink-muted">
        Not enough price history yet — click Refresh Prices.
      </div>
    );
  }

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const ratio = Math.min(1, Math.max(0, (x - PAD_LEFT) / innerWidth));
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(index);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const last = points[points.length - 1];
  const first = points[0];
  const changePct = ((last.value - first.value) / first.value) * 100;

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-ink-muted">Portfolio value</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatValue(last.value)}
          </p>
        </div>
        <p className={`text-sm font-medium ${changePct >= 0 ? "text-good" : "text-critical"}`}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(1)}% since {formatDate(first.date)}
        </p>
      </div>

      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {gridlines.map((v, i) => (
            <line
              key={i}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yForValue(v)}
              y2={yForValue(v)}
              className="stroke-line"
              strokeWidth={1}
            />
          ))}

          <path
            d={path}
            fill="none"
            className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* end-of-line direct label anchor */}
          <circle
            cx={xForIndex(points.length - 1)}
            cy={yForValue(last.value)}
            r={4}
            className="fill-[#2a78d6] dark:fill-[#3987e5]"
          />

          {hovered && hoverIndex != null ? (
            <>
              <line
                x1={xForIndex(hoverIndex)}
                x2={xForIndex(hoverIndex)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                className="stroke-ink-muted"
                strokeWidth={1}
              />
              <circle
                cx={xForIndex(hoverIndex)}
                cy={yForValue(hovered.value)}
                r={5}
                className="fill-[#2a78d6] dark:fill-[#3987e5]"
                stroke="var(--surface-card)"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${Math.min(85, Math.max(0, (xForIndex(hoverIndex!) / WIDTH) * 100))}%`,
            }}
          >
            <p className="font-semibold text-ink">{formatValue(hovered.value)}</p>
            <p className="text-ink-muted">{formatDate(hovered.date)}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>{formatDate(first.date)}</span>
        <span>{formatDate(last.date)}</span>
      </div>
    </div>
  );
}
