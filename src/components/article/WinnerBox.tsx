import Image from "next/image";
import { AffiliateButton } from "@/components/AffiliateButton";
import type { ResolvedProduct } from "@/types/product";

type WinnerBoxProps = {
  product: ResolvedProduct;
  reason?: string;
  className?: string;
};

export function WinnerBox({ product, reason, className = "" }: WinnerBoxProps) {
  return (
    <aside
      className={`overflow-hidden rounded-2xl border border-[var(--ink)] bg-[var(--paper)] ${className}`}
    >
      <div className="bg-[var(--ink)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white">
        Our pick
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-[140px_1fr] sm:items-center">
        <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-xl bg-[var(--canvas)] sm:w-full">
          <Image
            src={product.image ?? "/images/guide-placeholder.svg"}
            alt={product.name}
            fill
            unoptimized
            className="object-contain p-4"
          />
        </div>
        <div>
          {product.badge ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
              {product.badge}
            </p>
          ) : null}
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]">
            {product.name}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {reason ?? product.verdict ?? product.summary ?? product.bestFor}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <AffiliateButton href={product.amazonUrl} label="Check price on Amazon" />
            {product.priceLabel ? (
              <span className="text-sm text-[var(--subtle)]">{product.priceLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
