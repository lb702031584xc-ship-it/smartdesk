import Link from "next/link";
import type { HomeCategory } from "@/lib/home";

type CategoryCardProps = {
  category: HomeCategory;
  index?: number;
};

export function CategoryCard({ category, index }: CategoryCardProps) {
  return (
    <article className="flex h-full flex-col border-t border-[var(--line)] pt-8">
      {typeof index === "number" ? (
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--subtle)]">
          {String(index).padStart(2, "0")}
        </p>
      ) : null}

      <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-medium leading-snug tracking-tight text-[var(--ink)]">
        <Link href={category.href} className="transition hover:opacity-70">
          {category.title}
        </Link>
      </h3>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">
        {category.description}
      </p>

      <Link
        href={category.href}
        className="mt-8 inline-flex text-sm font-semibold text-[var(--ink)] underline-offset-4 transition hover:underline"
      >
        Explore Guides
      </Link>
    </article>
  );
}
