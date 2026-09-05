/**
 * ArticleViewModel — UI-facing view of ArticleV1 (Phase 29).
 *
 * Separates the database/content contract from rendering needs.
 * Products come from the Product resolver — never catalog copies on Article.
 */
import type {
  ArticleDocumentV1,
  ArticlePublishingV1,
  ArticleV1,
  ArticleV1Type,
} from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type { TopicCluster } from "@/types/content-graph";
import type { ArticleProductPlacement } from "@/lib/article-products";

export type ArticleViewProduct = {
  placement: ArticleProductPlacement;
  /** Resolved ProductV1 — cards must use this, not raw product refs. */
  product: ProductV1Document;
  rank?: number;
  role?: string;
  /** Article-owned framing overrides. */
  summary?: string;
  verdict?: string;
  bestFor?: string;
};

export type ArticleViewRelatedArticle = {
  id: string;
  slug: string;
  title: string;
  type: ArticleV1Type;
  summary?: string;
};

export type ArticleViewSeo = {
  metaTitle: string;
  metaDescription: string;
  primaryKeyword?: string;
  secondaryKeywords: string[];
  canonical: string;
  noindex: boolean;
  keywords: string[];
};

export type ArticleViewModel = {
  article: ArticleV1;
  /** Markdown body (never HTML). */
  body: string;
  /** Rendered HTML from Markdown — presentation only. */
  contentHtml: string;
  readingTime: string;
  products: ArticleViewProduct[];
  relatedArticles: ArticleViewRelatedArticle[];
  topic: TopicCluster | null;
  seo: ArticleViewSeo;
  publishing: ArticlePublishingV1;
  document: ArticleDocumentV1;
};

export type ArticleRendererMode = "legacy" | "native";
