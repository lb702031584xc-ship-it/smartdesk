import { ProductCard } from "@/components/article/ProductCard";
import { productV1ToLegacyProduct } from "@/lib/product-schema";
import { roleToLegacyBadge } from "@/lib/article-schema";
import type { ArticleViewProduct } from "@/types/article-view-model";
import type { ResolvedProduct } from "@/types/product";

type NativeArticleProductListProps = {
  products: ArticleViewProduct[];
  showRank?: boolean;
  layout?: "stack" | "split";
};

/**
 * Product list that accepts resolved ProductV1 placements only.
 * Never renders raw article.products.primary into the UI.
 */
export function NativeArticleProductList({
  products,
  showRank = true,
  layout = "stack",
}: NativeArticleProductListProps) {
  const sorted = [...products].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
  );

  return (
    <div className="mt-10 space-y-8">
      {sorted.map((item) => {
        const legacy = productV1ToLegacyProduct(item.product);
        const resolved: ResolvedProduct = {
          ...legacy,
          rank: item.rank,
          badge: roleToLegacyBadge(item.role),
          summary: item.summary,
          verdict: item.verdict ?? legacy.verdict,
          bestFor: item.bestFor ?? legacy.bestFor,
          priceLabel: legacy.priceRange,
        };
        return (
          <ProductCard
            key={item.product.id}
            product={resolved}
            showRank={showRank}
            layout={layout}
          />
        );
      })}
    </div>
  );
}
