"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Holdings" },
  { href: "/explore", label: "Explore" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line px-4 py-6">
      <Link href="/" className="flex items-center gap-2 px-2">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-tight">Thesis Arena</span>
      </Link>

      <nav className="mt-8 flex flex-col gap-1">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-neutral-surface text-ink"
                  : "text-ink-secondary hover:bg-card-hover"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-auto px-2 text-xs text-ink-muted">Bull vs. Bear research</p>
    </aside>
  );
}
