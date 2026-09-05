"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/Container";
import { siteConfig } from "@/lib/site";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Guides" },
  { href: "/reviews", label: "Reviews" },
  { href: "/best-products", label: "Best Products" },
  { href: "/about", label: "About" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.25rem]">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--ink)] transition-opacity hover:opacity-70 sm:text-[1.35rem]"
        >
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition hover:border-[var(--ink)] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span className="relative block h-3.5 w-4">
            <span
              className={`absolute left-0 top-0 h-0.5 w-4 bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-1.5 h-0.5 w-4 bg-current transition ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`absolute left-0 top-3 h-0.5 w-4 bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </span>
        </button>
      </Container>

      <div
        id="mobile-menu"
        className={`border-t border-[var(--line)] bg-[var(--paper)] md:hidden ${open ? "block" : "hidden"}`}
      >
        <Container className="flex flex-col gap-1 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-3 text-base font-medium text-[var(--ink)] transition hover:bg-[var(--canvas)]"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </Container>
      </div>
    </header>
  );
}
