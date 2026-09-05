import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type AdminWriteMode = "disabled" | "development" | "database";

export type AdminSaveResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  blocked?: boolean;
  blockedReason?: string;
  version?: number;
  /** True when public cache refresh succeeded after save. Omitted when not attempted. */
  revalidated?: boolean;
  /** True when a revision snapshot was created before overwrite. */
  revisionCreated?: boolean;
};

export type ProductListItem = {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  availability?: string;
  featured: boolean;
  rating?: number;
  lastChecked?: string;
  asin?: string;
  amazonUrl?: string;
  hasGallery: boolean;
};

export type ArticleListItem = {
  id: string;
  title: string;
  slug: string;
  type: string;
  category?: string;
  status: string;
  intent: string;
  primaryKeyword?: string;
  updatedAt?: string;
  scheduledAt?: string;
  featured: boolean;
};

export type AttentionItem = {
  severity: "error" | "warning" | "info";
  message: string;
  href?: string;
};

export type AdminOverviewStats = {
  productCount: number;
  articleCount: number;
  productV1Count: number;
  articleV1Count: number;
  draftArticles: number;
  reviewArticles: number;
  scheduledArticles: number;
  publishedArticles: number;
  archivedArticles: number;
  featuredArticles: number;
  featuredProducts: number;
  writeMode: AdminWriteMode;
  attention: AttentionItem[];
};

export type AdminProductRecord = {
  product: ProductV1Document;
  sourceFile: string;
  version?: number;
};

export type AdminArticleRecord = {
  article: ArticleV1;
  sourceFile: string;
  body?: string;
  version?: number;
};
