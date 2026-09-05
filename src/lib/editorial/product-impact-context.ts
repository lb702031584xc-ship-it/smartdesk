import {
  buildProductDependencies,
  type ProductDependencyProfile,
} from "@/lib/editorial/product-maintenance";
import {
  flattenMaterialChangeFields,
  getProductMaterialChanges,
  hasProductMaterialChanges,
  type ProductMaterialChange,
} from "@/lib/editorial/product-material-change";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type ProductMaterialChangeContext = {
  available: boolean;
  changedAt?: string;
  changedBy?: string;
  revisionNumber?: number;
  materialChanges: ProductMaterialChange[];
  materialFields: string[];
  dependencies: ProductDependencyProfile;
  publishedArticles: ProductDependencyProfile["articles"];
  reviewArticles: ProductDependencyProfile["articles"];
  bestListArticles: ProductDependencyProfile["articles"];
  comparisonArticles: ProductDependencyProfile["articles"];
};

export function buildProductMaterialChangeContext(input: {
  productId: string;
  current: ProductV1Document;
  previousSnapshot?: ProductV1Document;
  revisionMeta?: { createdAt: string; createdBy: string; revisionNumber: number };
  articles: ArticleV1[];
}): ProductMaterialChangeContext {
  const dependencies =
    buildProductDependencies([input.current], input.articles).get(input.productId) ?? {
      productId: input.productId,
      totalRefs: 0,
      publishedRefs: 0,
      bestListRefs: 0,
      reviewRefs: 0,
      comparisonRefs: 0,
      articles: [],
    };

  const publishedArticles = dependencies.articles.filter((a) => a.status === "published");
  const reviewArticles = dependencies.articles.filter((a) => a.type === "review");
  const bestListArticles = dependencies.articles.filter((a) => a.type === "best-list");
  const comparisonArticles = dependencies.articles.filter((a) => a.type === "comparison");

  if (!input.previousSnapshot) {
    return {
      available: false,
      materialChanges: [],
      materialFields: [],
      dependencies,
      publishedArticles,
      reviewArticles,
      bestListArticles,
      comparisonArticles,
    };
  }

  const materialChanges = getProductMaterialChanges(input.previousSnapshot, input.current);
  return {
    available: hasProductMaterialChanges(materialChanges),
    changedAt: input.revisionMeta?.createdAt,
    changedBy: input.revisionMeta?.createdBy,
    revisionNumber: input.revisionMeta?.revisionNumber,
    materialChanges,
    materialFields: flattenMaterialChangeFields(materialChanges),
    dependencies,
    publishedArticles,
    reviewArticles,
    bestListArticles,
    comparisonArticles,
  };
}
