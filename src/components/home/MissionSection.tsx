import Link from "next/link";
import { Container } from "@/components/Container";

export function MissionSection() {
  return (
    <section
      aria-labelledby="mission-heading"
      className="border-y border-[var(--line)] bg-[var(--canvas)]"
    >
      <Container className="max-w-3xl py-20 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
          Our Mission
        </p>
        <h2
          id="mission-heading"
          className="mt-4 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl"
        >
          We help people create productive workspaces without needing a large
          room.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          SmartDeskSetup focuses on apartments, studios, and spare corners—where
          every inch matters and comfort still has to last a full workday.
        </p>
        <Link
          href="/about"
          className="mt-8 inline-flex text-sm font-semibold text-[var(--ink)] transition hover:opacity-70"
        >
          Learn more about us →
        </Link>
      </Container>
    </section>
  );
}
