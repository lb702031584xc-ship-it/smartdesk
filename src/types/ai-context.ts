/**
 * AI Context read models (Phase 43).
 *
 * Derived from ProductV1, ArticleV1, Content Graph, intelligence, and
 * operations layers. Does not duplicate canonical documents.
 */

import type {
  EditorialWorkflowEntityType,
  EditorialWorkflowStatus,
} from "@/types/editorial-workflow";
import type { AISuggestionViewModel } from "@/types/ai-suggestion";
import type { AIRecommendationViewModel } from "@/types/ai-recommendation";
import type { EditorialTaskViewModel } from "@/types/editorial-task";

export type AIContextEntityType = EditorialWorkflowEntityType;

export type AIContextRelatedRef = {
  id: string;
  name: string;
  kind: "product" | "article";
};

export type AIContextTopicRef = {
  topicId: string;
  articleCount: number;
  productCount: number;
  coverage: string | null;
};

/** Compact entity snapshot — identifiers and editorial/SEO flags only. */
export type AIContextEntitySummary = {
  entityType: AIContextEntityType;
  entityId: string;
  name: string;
  status: string | null;
  topicId: string | null;
  category: string | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    primaryKeyword: string | null;
  };
  editorial: {
    summary: string | null;
    intentOrRole: string | null;
    verdict: string | null;
    bestFor: string[];
  };
  commerce: {
    availability: string | null;
    hasAsin: boolean;
  };
  featuredProductIds: string[];
};

export type AIContextViewModel = {
  entityType: AIContextEntityType;
  entityId: string;
  entity: AIContextEntitySummary;
  relatedProducts: AIContextRelatedRef[];
  relatedArticles: AIContextRelatedRef[];
  topic: AIContextTopicRef | null;
  intelligenceSignals: string[];
  activeTasks: EditorialTaskViewModel[];
  suggestions: AISuggestionViewModel[];
  recommendations: AIRecommendationViewModel[];
  workflowStatus: EditorialWorkflowStatus | null;
};
