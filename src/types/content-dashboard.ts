/**
 * Content Intelligence Dashboard read models (Phase 32).
 *
 * Derived only from Content Intelligence / Content Graph.
 * No schema duplication. No mutations. No UI.
 */

import type {
  CommerceContentSignals,
  TopicCoverageLevel,
  TopicCoverageRow,
} from "@/types/content-intelligence";
import type {
  ContentGraphArticleRef,
  ContentGraphIntegrityResult,
  ContentGraphProductRef,
} from "@/types/content-graph";

export type ProductCoverageStatus =
  | "covered"
  | "unreferenced"
  | "thin";

/**
 * Top-level dashboard overview for future UI.
 */
export type ContentOverviewViewModel = {
  totalArticles: number;
  totalProducts: number;
  totalTopics: number;
  publishedArticles: number;
  articlesWithProducts: number;
  articlesWithoutProducts: number;
  orphanArticles: ContentGraphArticleRef[];
  productsWithoutContent: ContentGraphProductRef[];
  topicCoverage: TopicCoverageRow[];
  commercial: CommerceContentSignals;
  integrity: ContentGraphIntegrityResult;
};

/**
 * Topic page / topic health card data.
 */
export type TopicHealthViewModel = {
  topic: string;
  articleCount: number;
  productCount: number;
  coverageStatus: TopicCoverageLevel;
  expansionSignal: boolean;
  articleIds: string[];
  productIds: string[];
};

/**
 * Product coverage card / product page intelligence.
 */
export type ProductCoverageViewModel = {
  productId: string;
  name: string;
  category: string;
  hasArticles: boolean;
  articleCount: number;
  articleIds: string[];
  coverageStatus: ProductCoverageStatus;
};
