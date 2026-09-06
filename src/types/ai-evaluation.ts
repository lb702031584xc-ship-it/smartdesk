/**
 * AI Evaluation Dataset & Quality Analytics (Phase 46).
 *
 * Reproducible evaluation records from assistance + feedback + outcomes.
 * Analytics ≠ Optimization. Dataset ≠ Training Dataset. Evaluation ≠ Learning.
 */

import type { AIAssistanceStatus, AIAssistanceType } from "@/types/ai-assistance";
import type {
  AIFeedbackDisposition,
  AIFeedbackReason,
  AIAssistanceFeedbackEventRecord,
} from "@/types/ai-feedback";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

/** Immutable snapshot schema version for evaluation records. */
export const EVALUATION_SNAPSHOT_VERSION = 1 as const;

export type AttributionLinkage = "explicit" | "unknown";

export type ProvenanceValue = string | "not-recorded" | "unknown";

export type AIGenerationMetadata = {
  provider: ProvenanceValue;
  model: ProvenanceValue;
  promptKey: ProvenanceValue;
  promptVersion: ProvenanceValue;
  contextVersion: ProvenanceValue;
};

export type AIEvaluationContextSnapshot = {
  /** Compact serialized context (already redacted). */
  serialized: string;
  hash: string | "unknown";
};

export type AIEvaluationOutputSnapshot = {
  raw: string;
  structured: unknown | null;
};

export type AIEvaluationFeedbackSnapshot = {
  disposition: AIFeedbackDisposition | null;
  reason: AIFeedbackReason | null;
  note: string | null;
  actor: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** true when eligible terminal assistance has no feedback row */
  noFeedback: boolean;
};

export type AIEvaluationOutcomeSnapshot = {
  suggestionId: string | null;
  taskId: string | null;
  revisionId: string | null;
  outcome: string;
  taskStatus: string | null;
  suggestionStatus: string | null;
};

export type EditBurdenProxy = {
  available: boolean;
  characterDelta: number | null;
  /** Simple normalized length delta; not a quality score. */
  normalizedLengthDelta: number | null;
  note: string;
};

/**
 * Stable Evaluation Record — one per assistance.
 * Context/output come from assistance-time persistence (not live CMS JOIN).
 * Feedback/outcome reflect durable IDs + current linked row state for analytics.
 */
export type AIEvaluationRecord = {
  id: string;
  assistanceId: string;
  assistanceType: AIAssistanceType;
  assistanceStatus: AIAssistanceStatus;
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  generatedAt: string;
  generation: AIGenerationMetadata;
  context: AIEvaluationContextSnapshot;
  output: AIEvaluationOutputSnapshot;
  feedback: AIEvaluationFeedbackSnapshot;
  feedbackHistory: AIAssistanceFeedbackEventRecord[];
  outcome: AIEvaluationOutcomeSnapshot;
  attribution: {
    linkage: AttributionLinkage;
  };
  editBurden: EditBurdenProxy;
  qualityLabels: {
    hasFeedback: boolean;
    eligible: boolean;
    lowSampleWarning: boolean;
  };
  snapshot: {
    version: typeof EVALUATION_SNAPSHOT_VERSION;
    createdAt: string;
    mode: "live-derived" | "materialized";
  };
};

export type EvaluationTimeRange = "7d" | "30d" | "all";

export type EvaluationDatasetFilters = {
  timeRange?: EvaluationTimeRange;
  assistanceType?: AIAssistanceType | "all";
  disposition?: AIFeedbackDisposition | "all" | "no-feedback";
  reason?: AIFeedbackReason | "all";
  entityType?: EditorialWorkflowEntityType | "all";
  coverage?: "all" | "with-feedback" | "no-feedback";
};

export type SampleAwareRate = {
  count: number;
  total: number;
  rate: number | null;
  lowSample: boolean;
  label: string;
};

export type QualityByAssistanceType = {
  assistanceType: AIAssistanceType;
  assistanceCount: number;
  eligibleCount: number;
  feedbackCount: number;
  coverage: SampleAwareRate;
  acceptedAsIs: SampleAwareRate;
  acceptedWithEdits: SampleAwareRate;
  rejected: SampleAwareRate;
  notActionable: SampleAwareRate;
};

export type QualityByReason = {
  reason: AIFeedbackReason;
  count: number;
  rate: number | null;
  topAssistanceType: AIAssistanceType | null;
  lowSample: boolean;
  label: string;
};

export type ReasonByAssistanceType = {
  assistanceType: AIAssistanceType;
  reason: AIFeedbackReason;
  count: number;
  rateWithinType: number | null;
  lowSample: boolean;
  label: string;
};

export type AIQualityAnalyticsViewModel = {
  generatedAt: string;
  filters: EvaluationDatasetFilters;
  overview: {
    assistanceCount: number;
    eligibleCount: number;
    feedbackCount: number;
    noFeedbackCount: number;
    coverage: SampleAwareRate;
    acceptedAsIs: SampleAwareRate;
    acceptedWithEdits: SampleAwareRate;
    rejected: SampleAwareRate;
    notActionable: SampleAwareRate;
  };
  byAssistanceType: QualityByAssistanceType[];
  byReason: QualityByReason[];
  reasonByAssistanceType: ReasonByAssistanceType[];
  outcomeLinkage: {
    explicitCount: number;
    unknownCount: number;
    suggestionConversion: SampleAwareRate;
    taskConversion: SampleAwareRate;
    taskCompletion: SampleAwareRate;
    suggestionApplied: SampleAwareRate;
  };
  editBurden: {
    availableCount: number;
    unavailableCount: number;
    averageCharacterDelta: number | null;
    note: string;
  };
  metricDefinitions: {
    eligible: string;
    coverage: string;
    dispositionRates: string;
    outcomeRates: string;
    editBurden: string;
    lowSample: string;
  };
  records: AIEvaluationRecord[];
};

export const EVALUATION_FORBIDDEN_SIDE_EFFECTS = [
  "modify-content",
  "create-revision",
  "create-task",
  "modify-prompt",
  "modify-model",
  "change-config",
  "invoke-generation",
  "fine-tune",
  "upload-to-model-vendor",
  "auto-optimize",
] as const;
