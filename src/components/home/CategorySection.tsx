import { CategoryCard } from "@/components/CategoryCard";
import { Container } from "@/components/Container";
import { homeCategories } from "@/lib/home";

export function CategorySection() {
  return (
    <section
      aria-labelledby="categories-heading"
      className="py-24 sm:py-28"
    >
      <Container>
        <header className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--subtle)]">
            Guides
          </p>
          <h2
            id="categories-heading"
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl"
          >
            Browse Workspace Guides
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Start with the workspace problem you need to solve. Each path leads
            to practical guides—not a product aisle.
          </p>
        </header>

        <div className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {homeCategories.map((category, index) => (
            <CategoryCard
              key={category.slug}
              category={category}
              index={index + 1}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
