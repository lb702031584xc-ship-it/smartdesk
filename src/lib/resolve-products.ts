import type { ProductRef, ResolvedProduct } from "@/types/product";
import { getProductById, getProductByIdSync } from "@/lib/products";

export function resolveProductRefsSync(
  refs: ProductRef[] = [],
): ResolvedProduct[] {
  const resolved: ResolvedProduct[] = [];

  for (const ref of refs) {
    const product = getProductByIdSync(ref.id);
    if (!product) continue;

    resolved.push({
      ...product,
      rank: ref.rank,
      badge: ref.badge,
      summary: ref.summary,
      verdict: ref.verdict ?? product.verdict,
      bestFor: ref.bestFor ?? product.bestFor,
      priceLabel: product.priceRange,
    });
  }

  return resolved;
}

export async function resolveProductRefs(
  refs: ProductRef[] = [],
): Promise<ResolvedProduct[]> {
  const resolved: ResolvedProduct[] = [];

  for (const ref of refs) {
    const product = await getProductById(ref.id);
    if (!product) continue;

    resolved.push({
      ...product,
      rank: ref.rank,
      badge: ref.badge,
      summary: ref.summary,
      verdict: ref.verdict ?? product.verdict,
      bestFor: ref.bestFor ?? product.bestFor,
      priceLabel: product.priceRange,
    });
  }

  return resolved;
}
