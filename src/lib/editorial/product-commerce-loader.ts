import { listArticlesV1 } from "@/lib/content/articles";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { listProductRevisions } from "@/lib/db/revisions";
import { buildProductDependencies } from "@/lib/editorial/product-maintenance";
import { buildProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";
import type { ProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";
import type { ProductDependencyProfile } from "@/lib/editorial/product-maintenance";
import type { ProductV1Document } from "@/types/product-v1";

export async function loadProductDependencyProfile(
  productId: string,
): Promise<ProductDependencyProfile> {
  const articles = await listArticlesV1();
  const allProducts = await import("@/lib/content/products").then((m) => m.listProductsV1());
  const map = buildProductDependencies(allProducts, articles);
  return (
    map.get(productId) ?? {
      productId,
      totalRefs: 0,
      publishedRefs: 0,
      bestListRefs: 0,
      reviewRefs: 0,
      comparisonRefs: 0,
      articles: [],
    }
  );
}

export async function loadProductMaterialChangeContext(
  product: ProductV1Document,
): Promise<ProductMaterialChangeContext> {
  const articles = await listArticlesV1();
  let latest = undefined;
  if (isDatabaseContentStore()) {
    const revisions = await listProductRevisions(product.id);
    latest = revisions[0];
  }
  return buildProductMaterialChangeContext({
    productId: product.id,
    current: product,
    previousSnapshot: latest?.data,
    revisionMeta: latest
      ? {
          createdAt: latest.createdAt.toISOString(),
          createdBy: latest.createdBy,
          revisionNumber: latest.revisionNumber,
        }
      : undefined,
    articles,
  });
}
