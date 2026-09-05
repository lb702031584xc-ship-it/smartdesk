/**
 * AI Assistance Human Feedback service (Phase 45).
 *
 * Capture / store / query / aggregate only.
 * Does NOT learn, optimize, mutate content, create tasks/revisions, or change prompts.
 *
 * Consistency with assistance.status:
 * - accepted → disposition ∈ {accepted-as-is, accepted-with-edits}
 * - rejected → disposition ∈ {rejected, not-actionable}
 * - draft/reviewed → feedback not allowed (complete Accept/Reject first)
 */

import { isDatabaseContentStore } from "@/lib/content/store-config";
import { findAIAssistanceById, listAllAIAssistance } from "@/lib/ai-assistance-store";
import {
  findFeedbackByAssistanceId,
  insertFeedback,
  listAllFeedback,
  listFeedbackEvents,
  updateFeedback,
} from "@/lib/ai-feedback-store";
import { resolveAIAssistanceOutcome } from "@/lib/ai-outcomes";
import type { AIAssistanceRecord, AIAssistanceStatus, AIAssistanceType } from "@/types/ai-assistance";
import type {
  AIAssistanceFeedbackViewModel,
  AIEvaluationMetricsViewModel,
  AIFeedbackDisposition,
  AIFeedbackReason,
  FeedbackByAssistanceType,
  FeedbackOutcomeJoin,
} from "@/types/ai-feedback";
import {
  AI_FEEDBACK_DISPOSITIONS,
  AI_FEEDBACK_REASONS,
} from "@/types/ai-feedback";

const ASSISTANCE_TYPES: readonly AIAssistanceType[] = [
  "seo",
  "content-improvement",
  "product-editorial",
  "internal-link",
] as const;

export type FeedbackResult =
  | { success: true; feedback: AIAssistanceFeedbackViewModel }
  | { success: false; error: string; message: string };

function rate(n: number, d: number): number | null {
  if (d <= 0) return null;
  return Math.round((n / d) * 1000) / 1000;
}

export function isValidDisposition(
  value: unknown,
): value is AIFeedbackDisposition {
  return (
    typeof value === "string" &&
    (AI_FEEDBACK_DISPOSITIONS as readonly string[]).includes(value)
  );
}

export function isValidReason(value: unknown): value is AIFeedbackReason {
  return (
    typeof value === "string" &&
    (AI_FEEDBACK_REASONS as readonly string[]).includes(value)
  );
}

/**
 * Enforce status ↔ disposition ownership so feedback cannot contradict
 * assistance.status without an explicit rule.
 */
export function assertDispositionConsistentWithStatus(
  status: AIAssistanceStatus,
  disposition: AIFeedbackDisposition,
): { ok: true } | { ok: false; message: string } {
  if (status === "accepted") {
    if (
      disposition === "accepted-as-is" ||
      disposition === "accepted-with-edits"
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        `Assistance status is accepted; disposition must be accepted-as-is or accepted-with-edits (got ${disposition}).`,
    };
  }
  if (status === "rejected") {
    if (disposition === "rejected" || disposition === "not-actionable") {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        `Assistance status is rejected; disposition must be rejected or not-actionable (got ${disposition}).`,
    };
  }
  return {
    ok: false,
    message:
      `Feedback requires terminal assistance status (accepted|rejected); current status is ${status}.`,
  };
}

function toViewModel(
  feedback: NonNullable<
    Awaited<ReturnType<typeof findFeedbackByAssistanceId>>
  >,
  assistance: AIAssistanceRecord | null,
): AIAssistanceFeedbackViewModel {
  return {
    id: feedback.id,
    assistanceId: feedback.assistanceId,
    disposition: feedback.disposition,
    reason: feedback.reason,
    note: feedback.note,
    createdBy: feedback.createdBy,
    createdAt: feedback.createdAt,
    updatedBy: feedback.updatedBy,
    updatedAt: feedback.updatedAt,
    assistanceType: assistance?.type ?? null,
    entityType: assistance?.entityType ?? null,
    entityId: assistance?.entityId ?? null,
    assistanceStatus: assistance?.status ?? null,
  };
}

export async function getFeedbackForAssistance(
  assistanceId: string,
): Promise<AIAssistanceFeedbackViewModel | null> {
  if (!isDatabaseContentStore()) return null;
  const feedback = await findFeedbackByAssistanceId(assistanceId);
  if (!feedback) return null;
  const assistance = (await findAIAssistanceById(assistanceId)) ?? null;
  return toViewModel(feedback, assistance);
}

export async function submitAssistanceFeedback(input: {
  assistanceId: string;
  disposition: unknown;
  reason: unknown;
  note?: string | null;
  actor: string;
}): Promise<FeedbackResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI feedback requires CONTENT_STORE=database.",
    };
  }
  if (!input.actor?.trim()) {
    return {
      success: false,
      error: "UNAUTHORIZED",
      message: "Actor is required.",
    };
  }
  if (!isValidDisposition(input.disposition)) {
    return {
      success: false,
      error: "INVALID_DISPOSITION",
      message: `Invalid disposition: ${String(input.disposition)}`,
    };
  }
  if (!isValidReason(input.reason)) {
    return {
      success: false,
      error: "INVALID_REASON",
      message: `Invalid reason: ${String(input.reason)}`,
    };
  }

  const assistance = await findAIAssistanceById(input.assistanceId);
  if (!assistance) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Assistance not found: ${input.assistanceId}`,
    };
  }

  const consistency = assertDispositionConsistentWithStatus(
    assistance.status,
    input.disposition,
  );
  if (!consistency.ok) {
    return {
      success: false,
      error: "STATUS_MISMATCH",
      message: consistency.message,
    };
  }

  const note =
    input.reason === "other"
      ? (input.note?.trim() || null)
      : (input.note?.trim() || null);

  if (input.reason === "other" && !note) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: 'Reason "other" requires a note.',
    };
  }

  const existing = await findFeedbackByAssistanceId(input.assistanceId);
  const saved = existing
    ? await updateFeedback({
        id: existing.id,
        disposition: input.disposition,
        reason: input.reason,
        note,
        updatedBy: input.actor,
      })
    : await insertFeedback({
        assistanceId: input.assistanceId,
        disposition: input.disposition,
        reason: input.reason,
        note,
        createdBy: input.actor,
      });

  if (!saved) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Failed to save feedback.",
    };
  }

  return { success: true, feedback: toViewModel(saved, assistance) };
}

export async function getFeedbackAuditTrail(assistanceId: string) {
  if (!isDatabaseContentStore()) return [];
  const feedback = await findFeedbackByAssistanceId(assistanceId);
  if (!feedback) return [];
  return listFeedbackEvents(feedback.id);
}

export async function getAIEvaluationMetrics(
  limit = 200,
): Promise<AIEvaluationMetricsViewModel> {
  const empty: AIEvaluationMetricsViewModel = {
    eligibleAssistanceCount: 0,
    feedbackCount: 0,
    feedbackCoverageRate: null,
    noFeedbackCount: 0,
    acceptedAsIsCount: 0,
    acceptedWithEditsCount: 0,
    rejectedCount: 0,
    notActionableCount: 0,
    acceptedAsIsRate: null,
    acceptedWithEditsRate: null,
    rejectionRate: null,
    notActionableRate: null,
    byDisposition: AI_FEEDBACK_DISPOSITIONS.map((disposition) => ({
      disposition,
      count: 0,
      rate: null,
    })),
    byReason: [],
    byAssistanceType: ASSISTANCE_TYPES.map((assistanceType) => ({
      assistanceType,
      feedbackCount: 0,
      acceptedAsIs: 0,
      acceptedWithEdits: 0,
      rejected: 0,
      notActionable: 0,
    })),
    outcomeJoins: [],
    metricDefinitions: {
      eligible:
        "Terminal assistance statuses (accepted | rejected). Draft/reviewed are excluded.",
      coverage:
        "Assistances with at least one feedback / eligible assistances. No-feedback ≠ rejected.",
      rates: "Disposition rates use feedbackCount as denominator (not eligible).",
    },
  };

  if (!isDatabaseContentStore()) return empty;

  const [assistances, feedbacks] = await Promise.all([
    listAllAIAssistance(limit),
    listAllFeedback(limit),
  ]);

  const eligible = assistances.filter(
    (a) => a.status === "accepted" || a.status === "rejected",
  );
  const feedbackByAssistance = new Map(
    feedbacks.map((f) => [f.assistanceId, f]),
  );

  const eligibleWithFeedback = eligible.filter((a) =>
    feedbackByAssistance.has(a.id),
  );
  const feedbackCount = feedbacks.length;
  const noFeedbackCount = eligible.length - eligibleWithFeedback.length;

  const acceptedAsIsCount = feedbacks.filter(
    (f) => f.disposition === "accepted-as-is",
  ).length;
  const acceptedWithEditsCount = feedbacks.filter(
    (f) => f.disposition === "accepted-with-edits",
  ).length;
  const rejectedCount = feedbacks.filter(
    (f) => f.disposition === "rejected",
  ).length;
  const notActionableCount = feedbacks.filter(
    (f) => f.disposition === "not-actionable",
  ).length;

  const byDisposition = AI_FEEDBACK_DISPOSITIONS.map((disposition) => {
    const count = feedbacks.filter((f) => f.disposition === disposition).length;
    return { disposition, count, rate: rate(count, feedbackCount) };
  });

  const reasonCounts = new Map<AIFeedbackReason, number>();
  for (const f of feedbacks) {
    reasonCounts.set(f.reason, (reasonCounts.get(f.reason) ?? 0) + 1);
  }
  const byReason = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const assistanceById = new Map(assistances.map((a) => [a.id, a]));
  const byAssistanceType: FeedbackByAssistanceType[] = ASSISTANCE_TYPES.map(
    (assistanceType) => {
      const rows = feedbacks.filter((f) => {
        const a = assistanceById.get(f.assistanceId);
        return a?.type === assistanceType;
      });
      return {
        assistanceType,
        feedbackCount: rows.length,
        acceptedAsIs: rows.filter((r) => r.disposition === "accepted-as-is")
          .length,
        acceptedWithEdits: rows.filter(
          (r) => r.disposition === "accepted-with-edits",
        ).length,
        rejected: rows.filter((r) => r.disposition === "rejected").length,
        notActionable: rows.filter((r) => r.disposition === "not-actionable")
          .length,
      };
    },
  );

  // Explicit-link observational joins only (Phase 44 unknown discipline preserved)
  const outcomeJoins: FeedbackOutcomeJoin[] = [];
  for (const f of feedbacks.slice(0, 80)) {
    const assistance = assistanceById.get(f.assistanceId);
    if (!assistance) {
      outcomeJoins.push({
        assistanceId: f.assistanceId,
        disposition: f.disposition,
        outcome: "unknown",
        linkage: "unknown",
        suggestionId: null,
        taskId: null,
      });
      continue;
    }
    const outcome = await resolveAIAssistanceOutcome(assistance);
    const hasLink = Boolean(assistance.suggestionId || assistance.taskId);
    outcomeJoins.push({
      assistanceId: f.assistanceId,
      disposition: f.disposition,
      outcome: outcome.outcome,
      linkage: hasLink ? "explicit" : "unknown",
      suggestionId: assistance.suggestionId,
      taskId: assistance.taskId,
    });
  }

  return {
    eligibleAssistanceCount: eligible.length,
    feedbackCount,
    feedbackCoverageRate: rate(eligibleWithFeedback.length, eligible.length),
    noFeedbackCount: Math.max(0, noFeedbackCount),
    acceptedAsIsCount,
    acceptedWithEditsCount,
    rejectedCount,
    notActionableCount,
    acceptedAsIsRate: rate(acceptedAsIsCount, feedbackCount),
    acceptedWithEditsRate: rate(acceptedWithEditsCount, feedbackCount),
    rejectionRate: rate(rejectedCount, feedbackCount),
    notActionableRate: rate(notActionableCount, feedbackCount),
    byDisposition,
    byReason,
    byAssistanceType,
    outcomeJoins,
    metricDefinitions: empty.metricDefinitions,
  };
}

/**
 * Safety stub — Phase 45 must never call these from feedback paths.
 * Exported for validation scripts to assert non-wiring.
 */
export const FEEDBACK_FORBIDDEN_SIDE_EFFECTS = [
  "content-mutation",
  "revision-creation",
  "task-creation",
  "suggestion-application",
  "prompt-change",
  "model-change",
  "scoring-change",
  "ranking-change",
  "recommendation-suppression",
] as const;
