/**
 * AI Suggestion models (Phase 40).
 *
 * Decision-support records only — never stored inside ProductV1 / ArticleV1.
 * Accept path must use existing mutation boundaries.
 */

import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

export type AISuggestionEntityType = EditorialWorkflowEntityType;

export type AISuggestionType =
  | "seo"
  | "content-gap"
  | "internal-link"
  | "editorial";

export type AISuggestionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

/**
 * Allowlisted target fields that can be applied via Phase 34/35 mutations.
 * content-gap / internal-link use advisory targets (no auto-write).
 */
export type AISuggestionTargetField =
  | "seo.metaTitle"
  | "seo.metaDescription"
  | "seo.primaryKeyword"
  | "seo.secondaryKeywords"
  | "editorial.summary"
  | "editorial.audience"
  | "editorial.intent"
  | "editorial.role"
  | "editorial.verdict"
  | "editorial.bestFor"
  | "editorial.notFor"
  | "content-gap.productCoverage"
  | "internal-link.relatedArticle";

export type AISuggestionRecord = {
  id: string;
  entityType: AISuggestionEntityType;
  entityId: string;
  suggestionType: AISuggestionType;
  targetField: AISuggestionTargetField;
  currentValue: string | null;
  proposedValue: string;
  reasoning: string;
  confidence: number;
  status: AISuggestionStatus;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  mutationRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AISuggestionViewModel = {
  id: string;
  entityType: AISuggestionEntityType;
  entityId: string;
  entityName: string;
  suggestionType: AISuggestionType;
  targetField: AISuggestionTargetField;
  currentValue: string | null;
  proposedValue: string;
  reasoning: string;
  confidence: number;
  status: AISuggestionStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  mutationRevisionId: string | null;
  /** True when accept routes through Phase 34/35 mutation boundaries. */
  applyable: boolean;
};

export type AISuggestionQueueViewModel = {
  pendingCount: number;
  items: AISuggestionViewModel[];
};
