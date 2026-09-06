"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/dashboard/editorial", label: "Editorial" },
  { href: "/dashboard/editorial/tasks", label: "Tasks" },
  { href: "/dashboard/intelligence", label: "Overview" },
  { href: "/dashboard/intelligence/topics", label: "Topics" },
  { href: "/dashboard/intelligence/products", label: "Products" },
  { href: "/dashboard/intelligence/activity", label: "Activity" },
  { href: "/dashboard/intelligence/reviews", label: "Reviews" },
  { href: "/dashboard/intelligence/changes", label: "Changes" },
  { href: "/dashboard/intelligence/ai", label: "AI" },
  { href: "/dashboard/intelligence/ai-assistance", label: "Assistance" },
  { href: "/dashboard/intelligence/ai-operations", label: "AI Ops" },
  { href: "/dashboard/intelligence/ai-evaluation", label: "Evaluation" },
  { href: "/dashboard/intelligence/recommendations", label: "Recommendations" },
];

/**
 * Read-only shell for Content Intelligence Dashboard.
 * Separate from Admin CMS editor — no edit affordances.
 */
export function IntelligenceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
              SmartDesk Intelligence
            </p>
            <p className="text-sm text-[var(--muted)]">
              Editorial operations and read-only intelligence
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => {
              const active =
                link.href === "/dashboard/editorial"
                  ? pathname === "/dashboard/editorial"
                  : link.href === "/dashboard/editorial/tasks"
                    ? pathname.startsWith("/dashboard/editorial/tasks")
                    : link.href === "/dashboard/intelligence"
                    ? pathname === "/dashboard/intelligence"
                    : link.href === "/dashboard/intelligence/ai"
                      ? pathname === "/dashboard/intelligence/ai"
                      : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--canvas)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Admin
            </Link>
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              View site
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
