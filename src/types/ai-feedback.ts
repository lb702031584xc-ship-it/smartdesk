/**
 * AI Assistance Human Feedback (Phase 45).
 *
 * Structured evaluation of AI outputs. Not operational outcomes (Phase 44).
 * Evaluation ≠ Learning — feedback never auto-changes prompts, models, scores, or content.
 */

import type { AIAssistanceType } from "@/types/ai-assistance";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

export type AIFeedbackDisposition =
  | "accepted-as-is"
  | "accepted-with-edits"
  | "rejected"
  | "not-actionable";

export type AIFeedbackReason =
  | "inaccurate"
  | "too-generic"
  | "wrong-intent"
  | "duplicate"
  | "outdated"
  | "useful-but-needs-editing"
  | "incomplete"
  | "wrong-context"
  | "other";

export const AI_FEEDBACK_DISPOSITIONS: readonly AIFeedbackDisposition[] = [
  "accepted-as-is",
  "accepted-with-edits",
  "rejected",
  "not-actionable",
] as const;

export const AI_FEEDBACK_REASONS: readonly AIFeedbackReason[] = [
  "inaccurate",
  "too-generic",
  "wrong-intent",
  "duplicate",
  "outdated",
  "useful-but-needs-editing",
  "incomplete",
  "wrong-context",
  "other",
] as const;

export type AIAssistanceFeedbackRecord = {
  id: string;
  assistanceId: string;
  disposition: AIFeedbackDisposition;
  reason: AIFeedbackReason;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type AIAssistanceFeedbackEventRecord = {
  id: string;
  feedbackId: string;
  assistanceId: string;
  actor: string;
  action: "create" | "update";
  previousDisposition: AIFeedbackDisposition | null;
  previousReason: AIFeedbackReason | null;
  newDisposition: AIFeedbackDisposition;
  newReason: AIFeedbackReason;
  note: string | null;
  createdAt: string;
};

export type AIAssistanceFeedbackViewModel = {
  id: string;
  assistanceId: string;
  disposition: AIFeedbackDisposition;
  reason: AIFeedbackReason;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  /** Joined for display — not duplicated storage of canonical fields. */
  assistanceType: AIAssistanceType | null;
  entityType: EditorialWorkflowEntityType | null;
  entityId: string | null;
  assistanceStatus: string | null;
};

export type FeedbackDispositionBreakdown = {
  disposition: AIFeedbackDisposition;
  count: number;
  rate: number | null;
};

export type FeedbackReasonBreakdown = {
  reason: AIFeedbackReason;
  count: number;
};

export type FeedbackByAssistanceType = {
  assistanceType: AIAssistanceType;
  feedbackCount: number;
  acceptedAsIs: number;
  acceptedWithEdits: number;
  rejected: number;
  notActionable: number;
};

/**
 * Observational join of feedback ↔ Phase 44 outcome.
 * Only when durable assistance → suggestion/task IDs exist.
 */
export type FeedbackOutcomeJoin = {
  assistanceId: string;
  disposition: AIFeedbackDisposition;
  outcome: string;
  linkage: "explicit" | "unknown";
  suggestionId: string | null;
  taskId: string | null;
};

export type AIEvaluationMetricsViewModel = {
  /** Assistances in terminal status (accepted | rejected). */
  eligibleAssistanceCount: number;
  feedbackCount: number;
  /**
   * feedbackCount / eligibleAssistanceCount.
   * Assistances without feedback are NOT counted as rejected.
   */
  feedbackCoverageRate: number | null;
  noFeedbackCount: number;
  acceptedAsIsCount: number;
  acceptedWithEditsCount: number;
  rejectedCount: number;
  notActionableCount: number;
  acceptedAsIsRate: number | null;
  acceptedWithEditsRate: number | null;
  rejectionRate: number | null;
  notActionableRate: number | null;
  byDisposition: FeedbackDispositionBreakdown[];
  byReason: FeedbackReasonBreakdown[];
  byAssistanceType: FeedbackByAssistanceType[];
  /** Explicit-link joins only; missing links stay unknown. */
  outcomeJoins: FeedbackOutcomeJoin[];
  metricDefinitions: {
    eligible:
      "Terminal assistance statuses (accepted | rejected). Draft/reviewed are excluded.";
    coverage:
      "Assistances with at least one feedback / eligible assistances. No-feedback ≠ rejected.";
    rates: "Disposition rates use feedbackCount as denominator (not eligible).";
  };
};
