import Image from "next/image";
import { AffiliateButton } from "@/components/AffiliateButton";
import { ProsCons } from "@/components/article/ProsCons";
import { RatingBox } from "@/components/article/RatingBox";
import type { ResolvedProduct } from "@/types/product";

type ArticleProductCardProps = {
  product: ResolvedProduct;
  showRank?: boolean;
  layout?: "stack" | "split";
  className?: string;
};

export function ProductCard({
  product,
  showRank = false,
  layout = "stack",
  className = "",
}: ArticleProductCardProps) {
  const imageSrc = product.image ?? "/images/guide-placeholder.svg";

  return (
    <article
      id={product.id}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] ${className}`}
    >
      <div
        className={`grid gap-0 ${layout === "split" ? "lg:grid-cols-[220px_1fr]" : ""}`}
      >
        <div className="relative aspect-[4/3] bg-[var(--canvas)] lg:aspect-auto lg:min-h-[220px]">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            unoptimized
            className="object-contain p-8"
          />
          {showRank && product.rank ? (
            <span className="absolute left-4 top-4 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[var(--ink)] px-3 text-sm font-semibold text-white">
              #{product.rank}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {product.badge ? (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  {product.badge}
                </p>
              ) : null}
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium leading-snug text-[var(--ink)]">
                {product.name}
              </h3>
              {product.bestFor ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--ink)]">Best for:</span>{" "}
                  {product.bestFor}
                </p>
              ) : null}
            </div>
            <div className="w-full max-w-[140px] sm:w-auto">
              <RatingBox rating={product.rating} label="Score" />
            </div>
          </div>

          {product.summary ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {product.summary}
            </p>
          ) : null}

          <ProsCons pros={product.pros} cons={product.cons} />

          <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
            <AffiliateButton
              href={product.amazonUrl}
              label="Check price on Amazon"
            />
            {product.priceLabel ? (
              <span className="text-sm text-[var(--subtle)]">
                {product.priceLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
