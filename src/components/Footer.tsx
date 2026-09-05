import Link from "next/link";
import { Container } from "@/components/Container";
import { siteConfig } from "@/lib/site";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--line)] bg-[var(--canvas)]">
      <Container className="grid gap-10 py-14 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {siteConfig.name}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            Expert guides and honest product picks for productive workspaces in
            apartments and small rooms.
          </p>
          <p className="mt-6 text-xs leading-relaxed text-[var(--subtle)]">
            As an Amazon Associate, we earn from qualifying purchases.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--subtle)]">
            Company
          </p>
          <ul className="mt-4 space-y-3">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-[var(--line)]">
        <Container className="flex flex-col gap-2 py-5 text-xs text-[var(--subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>Built for small rooms and focused work.</p>
        </Container>
      </div>
    </footer>
  );
}
