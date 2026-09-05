/**
 * Content Intelligence read models (Phase 31).
 *
 * Derived only from ArticleV1 + ProductV1 + Content Graph.
 * No schema duplication. No mutations.
 */

import type {
  ContentGraphArticleRef,
  ContentGraphIntegrityResult,
  ContentGraphProductRef,
  TopicCluster,
} from "@/types/content-graph";

export type TopicCoverageLevel = "good" | "thin" | "needs-expansion" | "empty";

export type TopicCoverageRow = {
  topicId: string;
  articleCount: number;
  productCount: number;
  coverage: TopicCoverageLevel;
};

export type ContentCoverageReport = {
  articles: {
    total: number;
    published: number;
    withProducts: number;
    withoutProducts: number;
  };
  products: {
    total: number;
    referenced: number;
    unreferenced: number;
  };
  topics: {
    total: number;
    rows: TopicCoverageRow[];
  };
};

export type CommerceContentSignals = {
  /** At least one product has no featuring article. */
  productWithoutArticle: boolean;
  /** At least one published article has no product refs. */
  articleWithoutProduct: boolean;
  /** Commercial/transactional published article without products. */
  highIntentWithoutCoverage: boolean;
  productWithoutArticleIds: string[];
  articleWithoutProductIds: string[];
  highIntentWithoutCoverageIds: string[];
};

/**
 * Corpus-level Content Intelligence ViewModel (dashboard read model).
 */
export type ContentIntelligenceViewModel = {
  articles: ContentGraphArticleRef[];
  products: ContentGraphProductRef[];
  topics: TopicCluster[];
  orphanArticles: ContentGraphArticleRef[];
  orphanProducts: ContentGraphProductRef[];
  topicCoverage: TopicCoverageRow[];
  commercialCoverage: CommerceContentSignals;
  coverage: ContentCoverageReport;
  integrity: ContentGraphIntegrityResult;
};

export type ContentHealthReport = {
  articleCount: number;
  productCount: number;
  topicCount: number;
  orphanArticles: ContentGraphArticleRef[];
  productsWithoutContent: ContentGraphProductRef[];
  topicsNeedingExpansion: TopicCoverageRow[];
  articlesWithoutProducts: ContentGraphArticleRef[];
  commercial: CommerceContentSignals;
  integrity: ContentGraphIntegrityResult;
};
