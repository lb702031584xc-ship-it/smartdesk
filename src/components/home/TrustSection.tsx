import { Container } from "@/components/Container";

const helpPoints = [
  {
    title: "Research Driven",
    description:
      "We compare products, features and real-world use cases.",
  },
  {
    title: "Space Focused",
    description:
      "We specialize in small home offices and compact setups.",
  },
  {
    title: "Practical Advice",
    description:
      "We focus on what actually works in everyday workspaces.",
  },
] as const;

export function TrustSection() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-[var(--line)] bg-[var(--canvas)]"
    >
      <Container className="py-16 sm:py-20">
        <h2 id="trust-heading" className="sr-only">
          Why readers trust SmartDeskSetup
        </h2>
        <ul className="grid gap-10 sm:grid-cols-3 sm:gap-12">
          {helpPoints.map((point) => (
            <li key={point.title}>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--ink)]">
                {point.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {point.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
