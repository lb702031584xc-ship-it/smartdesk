import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import type { Product } from "@/types/product";

type FeaturedProductsSectionProps = {
  products: Product[];
};

/** Map featured products to their full review articles when available. */
const reviewLinks: Record<string, string> = {
  "flexispot-compact": "/blog/flexispot-compact-standing-desk-review",
};

function getReviewHref(product: Product) {
  return reviewLinks[product.id] ?? `/category/${product.category}`;
}

export function FeaturedProductsSection({
  products,
}: FeaturedProductsSectionProps) {
  return (
    <section
      aria-labelledby="featured-products-heading"
      className="py-24 sm:py-28"
    >
      <Container>
        <header className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--subtle)]">
            Editorial
          </p>
          <h2
            id="featured-products-heading"
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl"
          >
            Editor&apos;s Picks
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Our recommendations based on workspace needs, room size, comfort and
            value.
          </p>
        </header>

        <div className="mt-14">
          {products.map((product, index) => (
            <article
              key={product.id}
              className={`grid gap-8 py-12 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-12 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-16 ${
                index === 0 ? "border-t border-[var(--line)]" : ""
              } border-b border-[var(--line)]`}
            >
              <div className="relative mx-auto aspect-square w-full max-w-[160px] sm:mx-0">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-contain"
                />
              </div>

              <div className="flex min-w-0 flex-col justify-center">
                <p className="text-sm text-[var(--subtle)]">
                  Rating{" "}
                  <span className="font-medium text-[var(--ink)]">
                    {product.rating.toFixed(1)}
                  </span>
                  <span aria-hidden> / 5</span>
                </p>

                <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-medium leading-snug tracking-tight text-[var(--ink)] sm:text-[1.75rem]">
                  {product.name}
                </h3>

                {product.bestFor ? (
                  <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">
                      Best for:
                    </span>{" "}
                    {product.bestFor}
                  </p>
                ) : null}

                {product.description ? (
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">
                      Why we picked it:
                    </span>{" "}
                    {product.description}
                  </p>
                ) : null}

                <div className="mt-8">
                  <Link
                    href={getReviewHref(product)}
                    className="inline-flex text-sm font-semibold text-[var(--ink)] underline-offset-4 transition hover:underline"
                  >
                    Read Full Review
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--subtle)]">
            Homepage picks are for guidance. Amazon purchase links live inside
            full reviews.
          </p>
          <Link
            href="/reviews"
            className="text-sm font-semibold text-[var(--ink)] transition hover:opacity-70"
          >
            Browse all reviews →
          </Link>
        </div>
      </Container>
    </section>
  );
}
