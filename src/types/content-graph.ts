/**
 * SmartDesk Content Commerce Graph — Phase 28–30 contracts.
 *
 * Ownership:
 * - Product owns product↔product links (`relationships.relatedProducts`)
 * - Article owns content links (`relationships.parentTopic`, `relatedArticles`, `relatedLinks`)
 * - Article↔Product edges are derived from `article.products.primary` (never duplicated
 *   into `article.relationships`)
 *
 * Phase 30 adds query ViewModels, SEO signals, and read-only link suggestions.
 * Does not mutate ProductV1 / ArticleV1 schemas.
 */

import type { ArticleV1, ArticleV1Type } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type ContentGraphNodeKind = "product" | "article" | "topic";

export type ContentGraphRelationshipType =
  | "PRODUCT_FEATURED_IN_ARTICLE"
  | "ARTICLE_REFERENCES_PRODUCT"
  | "ARTICLE_RELATED_TO_ARTICLE"
  | "ARTICLE_BELONGS_TO_TOPIC"
  | "PRODUCT_RELATED_TO_PRODUCT";

export type ContentGraphNode = {
  kind: ContentGraphNodeKind;
  id: string;
  label: string;
  category?: string;
  articleType?: ArticleV1Type;
};

export type ContentGraphEdge = {
  type: ContentGraphRelationshipType;
  fromId: string;
  toId: string;
  source:
    | "article.products"
    | "article.relationships.relatedArticles"
    | "article.relationships.parentTopic"
    | "product.relationships.relatedProducts"
    | "derived";
};

export type TopicCluster = {
  topicId: string;
  articleIds: string[];
  productIds: string[];
};

export type ArticleContentGraphView = {
  article: ArticleV1;
  products: ProductV1Document[];
  relatedArticles: ArticleV1[];
  topic: TopicCluster | null;
  edges: ContentGraphEdge[];
};

export type ContentGraph = {
  nodes: Map<string, ContentGraphNode>;
  edges: ContentGraphEdge[];
  topics: Map<string, TopicCluster>;
  articleIds: string[];
  productIds: string[];
};

export type ContentGraphIntegrityIssue = {
  severity: "error" | "warning";
  code:
    | "missing-article"
    | "missing-product"
    | "self-reference"
    | "duplicate-edge"
    | "ownership-violation"
    | "circular-reference";
  message: string;
  fromId?: string;
  toId?: string;
};

export type ContentGraphIntegrityResult = {
  valid: boolean;
  errors: ContentGraphIntegrityIssue[];
  warnings: ContentGraphIntegrityIssue[];
};

export type ContentGraphArticleRef = {
  articleId: string;
  slug: string;
  title: string;
  type: ArticleV1Type;
  status: string;
};

export type ContentGraphProductRef = {
  productId: string;
  name: string;
  category: string;
};

/**
 * Phase 30 — query ViewModel for one article.
 * Resolves from existing sources; does not copy Product/Article canonical fields.
 */
export type ContentGraphViewModel = {
  articleId: string;
  slug: string;
  title: string;
  topic: TopicCluster | null;
  products: ContentGraphProductRef[];
  relatedArticles: ContentGraphArticleRef[];
  incomingReferences: ContentGraphArticleRef[];
  outgoingReferences: ContentGraphArticleRef[];
  seoSignals: ContentGraphSeoSignals;
  linkSuggestions: InternalLinkSuggestion;
};

export type ContentGraphSeoSignals = {
  topicDepth: number;
  relatedArticleCount: number;
  productCoverage: number;
  orphanStatus: "orphan" | "connected" | "isolated-topic";
  incomingCount: number;
  outgoingCount: number;
  hasProducts: boolean;
  hasTopic: boolean;
};

export type InternalLinkSuggestionItem = {
  articleId: string;
  slug: string;
  title: string;
  reason: string;
};

export type InternalLinkSuggestion = {
  sourceArticle: string;
  suggestedArticles: InternalLinkSuggestionItem[];
};

export type ContentGraphReport = {
  articleCount: number;
  productCount: number;
  topicCount: number;
  orphanArticles: ContentGraphArticleRef[];
  articlesWithoutProducts: ContentGraphArticleRef[];
  productsWithoutArticles: ContentGraphProductRef[];
  sparseTopics: TopicCluster[];
  integrity: ContentGraphIntegrityResult;
};
