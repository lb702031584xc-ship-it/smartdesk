import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how SmartDeskSetup researches compact home office setups for apartments and small rooms.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
        About
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)]">
        Built for small rooms and serious work
      </h1>
      <div className="mt-8 space-y-5 text-base leading-relaxed text-[var(--muted)]">
        <p>
          {siteConfig.name} helps people create productive workspaces without
          needing a large room. We focus on apartments, studios, and spare
          corners where footprint, comfort, and clarity all compete for the same
          few square feet.
        </p>
        <p>
          Our guides and product picks emphasize honest tradeoffs—what works,
          what does not, and who each recommendation is actually best for.
        </p>
      </div>
      <Link
        href="/contact"
        className="mt-10 inline-flex text-sm font-semibold text-[var(--ink)] hover:opacity-70"
      >
        Contact us →
      </Link>
    </Container>
  );
}
