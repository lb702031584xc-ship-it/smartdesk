import { Container } from "@/components/Container";

const steps = [
  {
    step: "01",
    title: "Research",
    description:
      "We study product specifications, user needs, and workspace challenges.",
  },
  {
    step: "02",
    title: "Compare",
    description:
      "We compare comfort, size, value, and practical everyday use.",
  },
  {
    step: "03",
    title: "Recommend",
    description:
      "We highlight products that genuinely fit small home office setups.",
  },
] as const;

export function ReviewProcessSection() {
  return (
    <section
      aria-labelledby="review-process-heading"
      className="py-24 sm:py-28"
    >
      <Container>
        <header className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--subtle)]">
            How We Review Products
          </p>
          <h2
            id="review-process-heading"
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl"
          >
            How We Help You Choose Better
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            We research products, compare real-world features, and recommend
            solutions that fit different workspace needs.
          </p>
        </header>

        <ol className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10 lg:gap-14">
          {steps.map((item) => (
            <li key={item.step} className="border-t border-[var(--line)] pt-8">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--subtle)]">
                {item.step}
              </p>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[var(--ink)]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
