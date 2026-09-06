/**
 * AI Assistance models (Phase 43).
 *
 * Draft outputs for human review. Not canonical content.
 * Accept creates an AI suggestion or editorial task — never writes ProductV1 / ArticleV1.
 */

import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";
import type { AISuggestionTargetField, AISuggestionType } from "@/types/ai-suggestion";

export type AIAssistanceEntityType = EditorialWorkflowEntityType;

export type AIAssistanceType =
  | "seo"
  | "content-improvement"
  | "product-editorial"
  | "internal-link";

export type AIAssistanceStatus = "draft" | "reviewed" | "accepted" | "rejected";

export type AIAssistanceDraftPayload = {
  title: string;
  body: string;
  suggestionType: AISuggestionType | null;
  targetField: AISuggestionTargetField | null;
  proposedValue: string | null;
  currentValue: string | null;
};

export type AIAssistanceRecord = {
  id: string;
  entityType: AIAssistanceEntityType;
  entityId: string;
  type: AIAssistanceType;
  inputContext: string;
  output: string;
  status: AIAssistanceStatus;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  suggestionId: string | null;
  taskId: string | null;
  /** Phase 46 JSON provenance; null on legacy rows → not-recorded. */
  generationMetadata: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AIAssistanceViewModel = {
  id: string;
  entityType: AIAssistanceEntityType;
  entityId: string;
  entityName: string;
  type: AIAssistanceType;
  promptContext: string;
  output: string;
  draft: AIAssistanceDraftPayload | null;
  status: AIAssistanceStatus;
  suggestionId: string | null;
  taskId: string | null;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type AIAssistanceQueueViewModel = {
  draftCount: number;
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  items: AIAssistanceViewModel[];
  pendingReview: AIAssistanceViewModel[];
};
