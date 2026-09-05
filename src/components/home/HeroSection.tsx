import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";

const trustSignals = [
  "Updated regularly",
  "Expert research",
  "Practical workspace advice",
];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="bg-[var(--paper)]">
      <Container className="grid items-center gap-14 py-20 sm:gap-16 sm:py-24 lg:grid-cols-2 lg:gap-20 lg:py-28">
        <div className="animate-fade-up max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--subtle)]">
            SmartDeskSetup
          </p>

          <h1
            id="hero-heading"
            className="mt-6 font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.15] tracking-tight text-[var(--ink)] sm:text-5xl lg:text-[3.25rem]"
          >
            Create a Better Workspace in Any Small Room
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            Expert guides, workspace ideas, and carefully researched
            recommendations to help you build a productive home office.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-soft)]"
            >
              Explore Guides
            </Link>
            <Link
              href="/best-products"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--canvas)]"
            >
              See Our Picks
            </Link>
          </div>

          <ul className="mt-12 flex flex-col gap-3 border-t border-[var(--line)] pt-8 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
            {trustSignals.map((signal) => (
              <li
                key={signal}
                className="flex items-center gap-2 text-sm text-[var(--muted)]"
              >
                <span
                  aria-hidden
                  className="h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]"
                />
                {signal}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up-delay relative">
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--canvas)]">
            <Image
              src="/images/hero-workspace.jpg"
              alt="A beautiful small apartment home office with natural light, a minimal desk, ergonomic chair, monitor setup, and plants"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
