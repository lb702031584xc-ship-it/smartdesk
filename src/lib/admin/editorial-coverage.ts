import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type ArticleCoverageItem = {
  id: string;
  title: string;
  slug: string;
  type: string;
  category?: string;
  intent: string;
  primaryKeyword?: string;
  productIds: string[];
  status: string;
  featured: boolean;
};

export type ProductCoverageItem = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  articleCount: number;
  bestListCount: number;
  reviewCount: number;
  comparisonCount: number;
};

export type CoverageInventory = {
  articleCount: number;
  productCount: number;
  articlesByType: Record<string, number>;
  articlesByCategory: Record<string, number>;
  articlesByIntent: Record<string, number>;
  productsByCategory: Record<string, number>;
  unusedProducts: ProductCoverageItem[];
  productsWithoutReview: ProductCoverageItem[];
  articles: ArticleCoverageItem[];
  products: ProductCoverageItem[];
};

export function computeCoverageInventory(
  articles: ArticleV1[],
  products: ProductV1Document[],
): CoverageInventory {
  const articleItems: ArticleCoverageItem[] = articles.map((a) => ({
    id: a.identity.id,
    title: a.identity.title,
    slug: a.identity.slug,
    type: a.classification.type,
    category: a.classification.category,
    intent: a.editorial.intent,
    primaryKeyword: a.seo?.primaryKeyword,
    productIds: (a.products?.primary ?? []).map((r) => r.productId),
    status: a.publishing.status,
    featured: Boolean(a.publishing.featured),
  }));

  const productRefCounts = new Map<string, { total: number; bestList: number; review: number; comparison: number }>();
  for (const p of products) {
    productRefCounts.set(p.id, { total: 0, bestList: 0, review: 0, comparison: 0 });
  }
  for (const a of articleItems) {
    for (const pid of a.productIds) {
      const c = productRefCounts.get(pid);
      if (!c) continue;
      c.total++;
      if (a.type === "best-list") c.bestList++;
      if (a.type === "review") c.review++;
      if (a.type === "comparison") c.comparison++;
    }
  }

  const productItems: ProductCoverageItem[] = products.map((p) => {
    const c = productRefCounts.get(p.id) ?? { total: 0, bestList: 0, review: 0, comparison: 0 };
    return {
      id: p.id,
      name: p.identity.name,
      category: p.identity.category,
      subcategory: p.classification?.subcategory,
      articleCount: c.total,
      bestListCount: c.bestList,
      reviewCount: c.review,
      comparisonCount: c.comparison,
    };
  });

  const articlesByType: Record<string, number> = {};
  const articlesByCategory: Record<string, number> = {};
  const articlesByIntent: Record<string, number> = {};
  for (const a of articleItems) {
    articlesByType[a.type] = (articlesByType[a.type] ?? 0) + 1;
    if (a.category) articlesByCategory[a.category] = (articlesByCategory[a.category] ?? 0) + 1;
    articlesByIntent[a.intent] = (articlesByIntent[a.intent] ?? 0) + 1;
  }

  const productsByCategory: Record<string, number> = {};
  for (const p of productItems) {
    productsByCategory[p.category] = (productsByCategory[p.category] ?? 0) + 1;
  }

  return {
    articleCount: articleItems.length,
    productCount: productItems.length,
    articlesByType,
    articlesByCategory,
    articlesByIntent,
    productsByCategory,
    unusedProducts: productItems.filter((p) => p.articleCount === 0),
    productsWithoutReview: productItems.filter((p) => p.reviewCount === 0),
    articles: articleItems,
    products: productItems,
  };
}
