import type { ArticleSearchIntent, ArticleV1Type, ArticlePublishingStatus } from "@/types/article-v1";
import type {
  ProductAvailabilityV1,
  ProductCategoryV1,
  ProductEditorialRoleV1,
} from "@/types/product-v1";

export const PRODUCT_CATEGORIES: ProductCategoryV1[] = [
  "desks",
  "chairs",
  "monitors",
  "accessories",
];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategoryV1, string> = {
  desks: "Desk",
  chairs: "Chair",
  monitors: "Monitor",
  accessories: "Accessory",
};

export const PRODUCT_ROLES: ProductEditorialRoleV1[] = [
  "best-overall",
  "best-budget",
  "best-space-saving",
  "best-premium",
  "best-for-beginners",
  "best-value",
];

export const PRODUCT_AVAILABILITY: ProductAvailabilityV1[] = [
  "active",
  "inactive",
  "unknown",
];

export const ARTICLE_TYPES: ArticleV1Type[] = [
  "best-list",
  "review",
  "comparison",
  "guide",
  "how-to",
  "informational",
];

export const ARTICLE_INTENTS: ArticleSearchIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "mixed",
];

export const ARTICLE_STATUSES: ArticlePublishingStatus[] = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
];

export const PRODUCT_RATING_SCALE = { min: 0, max: 5, step: 0.1 } as const;
export const ARTICLE_RATING_SCALE = { min: 0, max: 5, step: 0.1 } as const;

export type AdminProductOption = {
  id: string;
  name: string;
  brand: string;
  category?: string;
  rating?: number;
};
