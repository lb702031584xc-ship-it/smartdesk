import type { ArticleProduct } from "@/types/article";

type ProsConsProps = {
  pros: string[];
  cons: string[];
  className?: string;
};

export function ProsCons({ pros, cons, className = "" }: ProsConsProps) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 ${className}`}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--success)]">
          Pros
        </h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
          {pros.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="font-semibold text-[var(--success)]">
                +
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
          Cons
        </h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
          {cons.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="font-semibold text-[var(--danger)]">
                −
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type ProductProsConsProps = {
  product: Pick<ArticleProduct, "pros" | "cons">;
  className?: string;
};

export function ProductProsCons({ product, className }: ProductProsConsProps) {
  return (
    <ProsCons pros={product.pros} cons={product.cons} className={className} />
  );
}
