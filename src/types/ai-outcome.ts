/**
 * AI Outcome / Operational Intelligence models (Phase 44).
 *
 * Observational feedback only — derived from stored evidence.
 * Does not invent causal links. Does not train, reweight, or mutate.
 */

import type { AIAssistanceStatus, AIAssistanceType } from "@/types/ai-assistance";
import type { AISuggestionStatus } from "@/types/ai-suggestion";
import type { EditorialTaskStatus } from "@/types/editorial-task";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";
import type { EditorialWorkflowStatus } from "@/types/editorial-workflow";
import type { AIRecommendationPriority } from "@/types/ai-recommendation";

export type AIOutcomeEntityType = EditorialWorkflowEntityType;

export type AIOutcomeSourceType =
  | "ai-assistance"
  | "ai-suggestion"
  | "ai-recommendation"
  | "editorial-task";

export type AIOutcomeDownstreamType = "ai-suggestion" | "editorial-task" | null;

/**
 * Outcomes established only from stored evidence.
 * Use unknown when the durable chain cannot be proven.
 */
export type AIOutcomeValue =
  | "pending"
  | "rejected"
  | "accepted-advisory"
  | "converted-to-suggestion"
  | "converted-to-task"
  | "applied"
  | "completed"
  | "published"
  | "unknown";

/** Descriptive conversion labels — not success claims. */
export type RecommendationConversionState =
  | "converted"
  | "not-converted"
  | "completed"
  | "pending";

export type AssistanceQualitySignal =
  | "high-acceptance"
  | "mixed"
  | "low-acceptance"
  | "insufficient-data";

/** Traceable hop used to explain how an outcome was derived. */
export type AIOutcomeProvenanceHop = {
  kind: AIOutcomeSourceType | "revision" | "workflow";
  id: string;
  label: string;
  status: string | null;
};

export type AIOutcomeViewModel = {
  sourceType: AIOutcomeSourceType;
  sourceId: string;
  entityType: AIOutcomeEntityType | "topic";
  entityId: string;
  assistanceType: AIAssistanceType | null;
  assistanceStatus: AIAssistanceStatus | null;
  downstreamType: AIOutcomeDownstreamType;
  downstreamId: string | null;
  downstreamStatus: string | null;
  canonicalChangeObserved: boolean;
  revisionId: string | null;
  workflowStatus: EditorialWorkflowStatus | null;
  outcome: AIOutcomeValue;
  provenance: AIOutcomeProvenanceHop[];
  timestamps: {
    sourceCreatedAt: string | null;
    sourceReviewedAt: string | null;
    resolvedAt: string;
  };
};

export type AssistanceTypePerformance = {
  assistanceType: AIAssistanceType;
  generated: number;
  accepted: number;
  rejected: number;
  pending: number;
  acceptanceRate: number | null;
  signal: AssistanceQualitySignal;
};

export type AIOperationalMetricsViewModel = {
  totalAssistance: number;
  pendingAssistance: number;
  acceptedAssistance: number;
  rejectedAssistance: number;
  acceptanceRate: number | null;
  suggestionsCreated: number;
  tasksCreated: number;
  suggestionsApplied: number;
  tasksCompleted: number;
  publishedOutcomes: number;
  byAssistanceType: AssistanceTypePerformance[];
};

export type RecommendationOutcomeViewModel = {
  recommendationId: string;
  priority: AIRecommendationPriority | null;
  taskCreated: boolean;
  taskId: string | null;
  taskStatus: EditorialTaskStatus | null;
  conversion: RecommendationConversionState;
};

export type SuggestionOutcomeViewModel = {
  suggestionId: string;
  entityType: AIOutcomeEntityType;
  entityId: string;
  status: AISuggestionStatus;
  mutationRevisionId: string | null;
  applied: boolean;
  outcome: AIOutcomeValue;
  provenance: AIOutcomeProvenanceHop[];
};

export type EntityAIOutcomeSummary = {
  entityType: AIOutcomeEntityType;
  entityId: string;
  assistanceCount: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  tasksCompleted: number;
  suggestionsApplied: number;
  outcomes: AIOutcomeViewModel[];
};

export type AIOperationalOverview = {
  metrics: AIOperationalMetricsViewModel;
  recentOutcomes: AIOutcomeViewModel[];
  assistancePerformance: AssistanceTypePerformance[];
  recommendationConversions: RecommendationOutcomeViewModel[];
  suggestionOutcomes: SuggestionOutcomeViewModel[];
  recommendationMetrics: {
    convertedToTasks: number;
    tasksStillOpen: number;
    tasksCompleted: number;
    liveRecommendations: number;
    notConverted: number;
  };
  suggestionMetrics: {
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
    applied: number;
    acceptedAdvisory: number;
  };
};
