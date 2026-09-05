"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/dashboard/editorial", label: "Editorial" },
  { href: "/dashboard/intelligence", label: "Intelligence" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/planning", label: "Planning" },
  { href: "/admin/links", label: "Links" },
  { href: "/admin/search", label: "Search" },
  { href: "/admin/refresh", label: "Refresh" },
  { href: "/admin/maintenance", label: "Maintenance" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--line)] bg-[var(--canvas)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            SmartDesk Admin
          </p>
          <p className="text-sm text-[var(--muted)]">V1 content editor foundation</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--ink)] text-white"
                    : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--canvas)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
          >
            View site
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="rounded-md px-3 py-1.5 text-sm text-[var(--danger)] ring-1 ring-[var(--line)] hover:bg-white"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
