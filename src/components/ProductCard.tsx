import Image from "next/image";
import type { Product } from "@/types/product";
import { AffiliateButton } from "@/components/AffiliateButton";
import { ProsCons } from "@/components/article/ProsCons";

type ProductCardProps = {
  product: Product;
};

/** Catalog product card for homepage and listing pages. */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] transition duration-300 hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[0_20px_50px_-30px_rgba(17,17,17,0.35)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--canvas)]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-8 transition duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--ink)]">
              <span aria-hidden>★</span> {product.rating.toFixed(1)}
            </p>
            <p className="text-sm text-[var(--subtle)]">{product.priceRange}</p>
          </div>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-medium leading-snug text-[var(--ink)]">
            {product.name}
          </h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">Best for:</span>{" "}
            {product.bestFor}
          </p>
        </div>

        <ProsCons pros={product.pros} cons={product.cons} />

        <div className="mt-auto pt-2">
          <AffiliateButton
            href={product.amazonUrl}
            label="View on Amazon"
            className="w-full"
          />
        </div>
      </div>
    </article>
  );
}
