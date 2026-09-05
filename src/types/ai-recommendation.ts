/**
 * AI Recommendation read models (Phase 41).
 *
 * Derived from Content Intelligence, Editorial Intelligence, and AI Suggestions.
 * No canonical schema duplication. No mutations.
 */

import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

export type AIRecommendationType =
  | "content-coverage"
  | "topic-expansion"
  | "seo-improvement"
  | "internal-linking";

export type AIRecommendationPriority = "high" | "medium" | "low";

export type AIRecommendationStatus = "open";

/** Human-readable signal tags explaining score inputs. */
export type AIRecommendationSignal = {
  label: string;
  weight: number;
  detail?: string;
};

export type AIRecommendationViewModel = {
  id: string;
  entityType: EditorialWorkflowEntityType | "topic";
  entityId: string;
  entityName: string;
  recommendationType: AIRecommendationType;
  title: string;
  reason: string;
  impact: string;
  signals: AIRecommendationSignal[];
  priorityScore: number;
  priority: AIRecommendationPriority;
  confidence: number;
  status: AIRecommendationStatus;
  /** Links to Phase 40 suggestion when applicable — never skips suggestion layer. */
  suggestionId: string | null;
  createdAt: string;
};

export type AIRecommendationQueueViewModel = {
  totalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  items: AIRecommendationViewModel[];
  byPriority: {
    high: AIRecommendationViewModel[];
    medium: AIRecommendationViewModel[];
    low: AIRecommendationViewModel[];
  };
};

export type RecommendationScoreInput = {
  recommendationType: AIRecommendationType;
  /** Base signal weights (transparent, not black-box). */
  signals: AIRecommendationSignal[];
  /** Optional AI suggestion confidence (0–100). */
  suggestionConfidence?: number;
  /** Freshness penalty boost for stale content (days). */
  staleDays?: number;
  /** Commerce / coverage boost. */
  commerceValue?: number;
};

export type RecommendationScoreResult = {
  priorityScore: number;
  priority: AIRecommendationPriority;
  confidence: number;
  reason: string;
};
