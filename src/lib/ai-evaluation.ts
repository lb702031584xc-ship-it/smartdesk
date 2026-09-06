/**
 * AI Evaluation Dataset Builder & Quality Analytics (Phase 46).
 *
 * Capture / snapshot / join / aggregate / export only.
 * Does NOT learn, optimize, fine-tune, mutate content, or change prompts/models.
 *
 * Attribution: explicit IDs only → otherwise unknown (no heuristics).
 */

import { createHash } from "crypto";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  findAIAssistanceById,
  listAllAIAssistance,
} from "@/lib/ai-assistance-store";
import { parseAssistanceDraft } from "@/lib/ai-assistance";
import {
  findFeedbackByAssistanceId,
  listAllFeedback,
  listFeedbackEvents,
} from "@/lib/ai-feedback-store";
import { resolveAIAssistanceOutcome } from "@/lib/ai-outcomes";
import { findAISuggestionById } from "@/lib/ai-suggestions-store";
import { findEditorialTaskById } from "@/lib/editorial-tasks-store";
import {
  ensureAIEvaluationTables,
  hashContextPayload,
  insertEvaluationSnapshot,
} from "@/lib/ai-evaluation-store";
import type { AIAssistanceRecord, AIAssistanceType } from "@/types/ai-assistance";
import {
  AI_FEEDBACK_DISPOSITIONS,
  AI_FEEDBACK_REASONS,
  type AIFeedbackDisposition,
} from "@/types/ai-feedback";
import type {
  AIEvaluationRecord,
  AIGenerationMetadata,
  AIQualityAnalyticsViewModel,
  EditBurdenProxy,
  EvaluationDatasetFilters,
  EvaluationTimeRange,
  SampleAwareRate,
  QualityByAssistanceType,
  QualityByReason,
  ReasonByAssistanceType,
} from "@/types/ai-evaluation";
import {
  EVALUATION_FORBIDDEN_SIDE_EFFECTS,
  EVALUATION_SNAPSHOT_VERSION,
} from "@/types/ai-evaluation";

const ASSISTANCE_TYPES: readonly AIAssistanceType[] = [
  "seo",
  "content-improvement",
  "product-editorial",
  "internal-link",
] as const;

const LOW_SAMPLE_THRESHOLD = 5;

const SECRET_KEY_RE =
  /^(.*)?(api[_-]?key|secret|token|password|authorization|cookie|private[_-]?key)(.*)?$/i;

export { EVALUATION_FORBIDDEN_SIDE_EFFECTS };

export function buildDefaultGenerationMetadata(
  contextHash: string,
): AIGenerationMetadata {
  return {
    provider: "deterministic-rules",
    model: "not-recorded",
    promptKey: "draftAssistanceFromContext",
    promptVersion: "1",
    contextVersion: contextHash || "unknown",
  };
}

export function parseGenerationMetadata(
  raw: string | null | undefined,
  contextHash: string,
): AIGenerationMetadata {
  if (!raw?.trim()) {
    return {
      provider: "not-recorded",
      model: "not-recorded",
      promptKey: "not-recorded",
      promptVersion: "not-recorded",
      contextVersion: contextHash || "unknown",
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AIGenerationMetadata>;
    return {
      provider: parsed.provider ?? "unknown",
      model: parsed.model ?? "unknown",
      promptKey: parsed.promptKey ?? "unknown",
      promptVersion: parsed.promptVersion ?? "unknown",
      contextVersion: parsed.contextVersion ?? (contextHash || "unknown"),
    };
  } catch {
    return {
      provider: "unknown",
      model: "unknown",
      promptKey: "unknown",
      promptVersion: "unknown",
      contextVersion: contextHash || "unknown",
    };
  }
}

/** Defensive redaction — does not claim to catch all secrets. */
export function redactContextForEvaluation(serialized: string): string {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return JSON.stringify(redactUnknown(parsed));
  } catch {
    return serialized;
  }
}

function redactUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactUnknown(child);
    }
  }
  return out;
}

function sampleRate(count: number, total: number): SampleAwareRate {
  const rate = total > 0 ? Math.round((count / total) * 1000) / 1000 : null;
  const lowSample = total > 0 && total < LOW_SAMPLE_THRESHOLD;
  const pct = rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
  return {
    count,
    total,
    rate,
    lowSample,
    label: `${pct} (${count} / ${total})${lowSample ? " · low sample" : ""}`,
  };
}

function withinTimeRange(iso: string, range: EvaluationTimeRange): boolean {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const days = range === "7d" ? 7 : 30;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function computeEditBurdenProxy(input: {
  currentValue: string | null;
  proposedValue: string | null;
  mutationRevisionId: string | null;
}): EditBurdenProxy {
  if (!input.mutationRevisionId) {
    return {
      available: false,
      characterDelta: null,
      normalizedLengthDelta: null,
      note: "Not available: no explicit mutation_revision_id linkage.",
    };
  }
  if (input.currentValue == null || input.proposedValue == null) {
    return {
      available: false,
      characterDelta: null,
      normalizedLengthDelta: null,
      note: "Not available: missing current/proposed values on suggestion.",
    };
  }
  const a = input.currentValue;
  const b = input.proposedValue;
  const characterDelta = Math.abs(b.length - a.length);
  const denom = Math.max(a.length, b.length, 1);
  const normalizedLengthDelta =
    Math.round((characterDelta / denom) * 1000) / 1000;
  return {
    available: true,
    characterDelta,
    normalizedLengthDelta,
    note: "Proxy from suggestion current→proposed lengths when applied (mutation_revision_id). Not an AI quality score.",
  };
}

async function buildEditBurdenForAssistance(
  assistance: AIAssistanceRecord,
): Promise<EditBurdenProxy> {
  if (!assistance.suggestionId) {
    return {
      available: false,
      characterDelta: null,
      normalizedLengthDelta: null,
      note: "Not available with current linkage (no suggestion_id).",
    };
  }
  const suggestion = await findAISuggestionById(assistance.suggestionId);
  if (!suggestion) {
    return {
      available: false,
      characterDelta: null,
      normalizedLengthDelta: null,
      note: "Not available: linked suggestion row missing.",
    };
  }
  return computeEditBurdenProxy({
    currentValue: suggestion.currentValue,
    proposedValue: suggestion.proposedValue,
    mutationRevisionId: suggestion.mutationRevisionId,
  });
}

/**
 * Build one Evaluation Record for an assistance.
 * One assistance → one record (events never inflate count).
 */
export async function buildEvaluationRecord(
  assistanceId: string,
): Promise<AIEvaluationRecord | null> {
  if (!isDatabaseContentStore()) return null;
  await ensureAIEvaluationTables();
  const assistance = await findAIAssistanceById(assistanceId);
  if (!assistance) return null;

  const redacted = redactContextForEvaluation(assistance.inputContext);
  const contextHash = assistance.inputContext
    ? hashContextPayload(assistance.inputContext)
    : "unknown";

  const generation = parseGenerationMetadata(
    assistance.generationMetadata,
    contextHash,
  );

  const feedback = await findFeedbackByAssistanceId(assistance.id);
  const history = feedback
    ? await listFeedbackEvents(feedback.id)
    : [];

  const outcomeVm = await resolveAIAssistanceOutcome(assistance);
  const linkage =
    assistance.suggestionId || assistance.taskId ? "explicit" : "unknown";

  let taskStatus: string | null = null;
  let suggestionStatus: string | null = null;
  if (assistance.taskId) {
    const task = await findEditorialTaskById(assistance.taskId);
    taskStatus = task?.status ?? null;
  }
  if (assistance.suggestionId) {
    const suggestion = await findAISuggestionById(assistance.suggestionId);
    suggestionStatus = suggestion?.status ?? null;
  }

  const eligible =
    assistance.status === "accepted" || assistance.status === "rejected";
  const editBurden = await buildEditBurdenForAssistance(assistance);
  const draft = parseAssistanceDraft(assistance.output);

  return {
    id: `eval:${assistance.id}`,
    assistanceId: assistance.id,
    assistanceType: assistance.type,
    assistanceStatus: assistance.status,
    entityType: assistance.entityType,
    entityId: assistance.entityId,
    generatedAt: assistance.createdAt,
    generation,
    context: {
      serialized: redacted,
      hash: contextHash,
    },
    output: {
      raw: assistance.output,
      structured: draft,
    },
    feedback: {
      disposition: feedback?.disposition ?? null,
      reason: feedback?.reason ?? null,
      note: feedback?.note ?? null,
      actor: feedback?.createdBy ?? null,
      createdAt: feedback?.createdAt ?? null,
      updatedAt: feedback?.updatedAt ?? null,
      noFeedback: eligible && !feedback,
    },
    feedbackHistory: history,
    outcome: {
      suggestionId: assistance.suggestionId,
      taskId: assistance.taskId,
      revisionId: outcomeVm.revisionId,
      outcome: outcomeVm.outcome,
      taskStatus,
      suggestionStatus,
    },
    attribution: { linkage },
    editBurden,
    qualityLabels: {
      hasFeedback: Boolean(feedback),
      eligible,
      lowSampleWarning: false,
    },
    snapshot: {
      version: EVALUATION_SNAPSHOT_VERSION,
      createdAt: new Date().toISOString(),
      mode: "live-derived",
    },
  };
}

export async function buildEvaluationDataset(
  filters: EvaluationDatasetFilters = {},
  limit = 200,
): Promise<AIEvaluationRecord[]> {
  if (!isDatabaseContentStore()) return [];
  await ensureAIEvaluationTables();
  const rows = await listAllAIAssistance(limit);
  const feedbackByAssistance = new Map(
    (await listAllFeedback()).map((f) => [f.assistanceId, f]),
  );

  // Prefetch not done for outcomes to keep correctness; builder is O(n) lookups.
  // Scale is small; avoid N+1 inflation by resolving once per assistance only.
  const records: AIEvaluationRecord[] = [];
  for (const row of rows) {
    // Attach generationMetadata from row if present via rebuild
    const record = await buildEvaluationRecord(row.id);
    if (!record) continue;
    // Ensure feedback map uniqueness (events must not create extra records)
    if (feedbackByAssistance.has(row.id) !== record.qualityLabels.hasFeedback) {
      // Prefer builder truth from findFeedbackByAssistanceId
    }
    if (!passesFilters(record, filters)) continue;
    records.push(record);
  }
  return records;
}

function passesFilters(
  record: AIEvaluationRecord,
  filters: EvaluationDatasetFilters,
): boolean {
  const timeRange = filters.timeRange ?? "all";
  if (!withinTimeRange(record.generatedAt, timeRange)) return false;

  if (
    filters.assistanceType &&
    filters.assistanceType !== "all" &&
    record.assistanceType !== filters.assistanceType
  ) {
    return false;
  }

  if (
    filters.entityType &&
    filters.entityType !== "all" &&
    record.entityType !== filters.entityType
  ) {
    return false;
  }

  if (filters.coverage === "with-feedback" && !record.qualityLabels.hasFeedback) {
    return false;
  }
  if (filters.coverage === "no-feedback" && record.qualityLabels.hasFeedback) {
    return false;
  }

  if (filters.disposition && filters.disposition !== "all") {
    if (filters.disposition === "no-feedback") {
      if (!record.feedback.noFeedback) return false;
    } else if (record.feedback.disposition !== filters.disposition) {
      return false;
    }
  }

  if (
    filters.reason &&
    filters.reason !== "all" &&
    record.feedback.reason !== filters.reason
  ) {
    return false;
  }

  return true;
}

export async function getAIQualityAnalytics(
  filters: EvaluationDatasetFilters = {},
): Promise<AIQualityAnalyticsViewModel> {
  const records = await buildEvaluationDataset(filters, 300);
  const eligible = records.filter((r) => r.qualityLabels.eligible);
  const withFeedback = eligible.filter((r) => r.qualityLabels.hasFeedback);
  const noFeedback = eligible.filter((r) => r.feedback.noFeedback);

  const dispositionCount = (d: AIFeedbackDisposition) =>
    withFeedback.filter((r) => r.feedback.disposition === d).length;

  const byAssistanceType: QualityByAssistanceType[] = ASSISTANCE_TYPES.map(
    (type) => {
      const typed = records.filter((r) => r.assistanceType === type);
      const typedEligible = typed.filter((r) => r.qualityLabels.eligible);
      const typedFeedback = typedEligible.filter(
        (r) => r.qualityLabels.hasFeedback,
      );
      const fbTotal = typedFeedback.length;
      return {
        assistanceType: type,
        assistanceCount: typed.length,
        eligibleCount: typedEligible.length,
        feedbackCount: fbTotal,
        coverage: sampleRate(fbTotal, typedEligible.length),
        acceptedAsIs: sampleRate(
          typedFeedback.filter((r) => r.feedback.disposition === "accepted-as-is")
            .length,
          fbTotal,
        ),
        acceptedWithEdits: sampleRate(
          typedFeedback.filter(
            (r) => r.feedback.disposition === "accepted-with-edits",
          ).length,
          fbTotal,
        ),
        rejected: sampleRate(
          typedFeedback.filter((r) => r.feedback.disposition === "rejected")
            .length,
          fbTotal,
        ),
        notActionable: sampleRate(
          typedFeedback.filter(
            (r) => r.feedback.disposition === "not-actionable",
          ).length,
          fbTotal,
        ),
      };
    },
  );

  const byReason: QualityByReason[] = AI_FEEDBACK_REASONS.map((reason) => {
    const matching = withFeedback.filter((r) => r.feedback.reason === reason);
    const count = matching.length;
    const typeCounts = new Map<AIAssistanceType, number>();
    for (const row of matching) {
      typeCounts.set(
        row.assistanceType,
        (typeCounts.get(row.assistanceType) ?? 0) + 1,
      );
    }
    let top: AIAssistanceType | null = null;
    let topN = 0;
    for (const [t, n] of typeCounts) {
      if (n > topN) {
        top = t;
        topN = n;
      }
    }
    const rateObj = sampleRate(count, withFeedback.length);
    return {
      reason,
      count,
      rate: rateObj.rate,
      topAssistanceType: top,
      lowSample: rateObj.lowSample,
      label: rateObj.label,
    };
  }).filter((row) => row.count > 0);

  const reasonByAssistanceType: ReasonByAssistanceType[] = [];
  for (const type of ASSISTANCE_TYPES) {
    const typedFeedback = withFeedback.filter((r) => r.assistanceType === type);
    for (const reason of AI_FEEDBACK_REASONS) {
      const count = typedFeedback.filter(
        (r) => r.feedback.reason === reason,
      ).length;
      if (count === 0) continue;
      const rateObj = sampleRate(count, typedFeedback.length);
      reasonByAssistanceType.push({
        assistanceType: type,
        reason,
        count,
        rateWithinType: rateObj.rate,
        lowSample: rateObj.lowSample,
        label: rateObj.label,
      });
    }
  }

  const accepted = records.filter((r) => r.assistanceStatus === "accepted");
  const withSuggestion = accepted.filter((r) => r.outcome.suggestionId);
  const withTask = accepted.filter((r) => r.outcome.taskId);
  const explicit = records.filter((r) => r.attribution.linkage === "explicit");
  const unknownLink = records.filter(
    (r) => r.attribution.linkage === "unknown",
  );
  const taskCompleted = withTask.filter(
    (r) => r.outcome.taskStatus === "completed",
  );
  const suggestionApplied = withSuggestion.filter(
    (r) => r.outcome.revisionId != null,
  );

  const editAvailable = records.filter((r) => r.editBurden.available);
  const avgDelta =
    editAvailable.length === 0
      ? null
      : Math.round(
          editAvailable.reduce(
            (sum, r) => sum + (r.editBurden.characterDelta ?? 0),
            0,
          ) / editAvailable.length,
        );

  return {
    generatedAt: new Date().toISOString(),
    filters,
    overview: {
      assistanceCount: records.length,
      eligibleCount: eligible.length,
      feedbackCount: withFeedback.length,
      noFeedbackCount: noFeedback.length,
      coverage: sampleRate(withFeedback.length, eligible.length),
      acceptedAsIs: sampleRate(
        dispositionCount("accepted-as-is"),
        withFeedback.length,
      ),
      acceptedWithEdits: sampleRate(
        dispositionCount("accepted-with-edits"),
        withFeedback.length,
      ),
      rejected: sampleRate(dispositionCount("rejected"), withFeedback.length),
      notActionable: sampleRate(
        dispositionCount("not-actionable"),
        withFeedback.length,
      ),
    },
    byAssistanceType,
    byReason,
    reasonByAssistanceType,
    outcomeLinkage: {
      explicitCount: explicit.length,
      unknownCount: unknownLink.length,
      suggestionConversion: sampleRate(withSuggestion.length, accepted.length),
      taskConversion: sampleRate(withTask.length, accepted.length),
      taskCompletion: sampleRate(taskCompleted.length, withTask.length),
      suggestionApplied: sampleRate(
        suggestionApplied.length,
        withSuggestion.length,
      ),
    },
    editBurden: {
      availableCount: editAvailable.length,
      unavailableCount: records.length - editAvailable.length,
      averageCharacterDelta: avgDelta,
      note:
        "Edit burden only when suggestion has mutation_revision_id + current/proposed values. Not a quality score.",
    },
    metricDefinitions: {
      eligible:
        "Terminal assistance statuses (accepted | rejected). Draft/reviewed excluded.",
      coverage:
        "Feedback rows / eligible assistances. No-feedback ≠ rejected. Events do not inflate counts.",
      dispositionRates:
        "Disposition rates use feedback count as denominator (not eligible).",
      outcomeRates:
        "Suggestion/task conversion among accepted only; completion among linked tasks; applied among linked suggestions with revision_id. Unknown linkage ≠ failure.",
      editBurden:
        "Character |Δ| between suggestion currentValue and proposedValue when mutation_revision_id is present.",
      lowSample: `Totals under ${LOW_SAMPLE_THRESHOLD} are marked low sample; rates still shown with (count / total).`,
    },
    records,
  };
}

export async function materializeEvaluationSnapshot(
  assistanceId: string,
): Promise<{ success: true; snapshotId: string } | { success: false; message: string }> {
  const record = await buildEvaluationRecord(assistanceId);
  if (!record) {
    return { success: false, message: "Assistance not found." };
  }
  const { id } = await insertEvaluationSnapshot(record);
  return { success: true, snapshotId: id };
}

export type EvaluationExportMode = "summary" | "detailed";

export function buildEvaluationExportCsv(
  records: AIEvaluationRecord[],
  mode: EvaluationExportMode = "summary",
): string {
  const headers = [
    "assistance_id",
    "assistance_type",
    "assistance_status",
    "entity_type",
    "entity_id",
    "generated_at",
    "provider",
    "model",
    "prompt_key",
    "prompt_version",
    "context_version",
    "disposition",
    "reason",
    "feedback_actor",
    "feedback_created_at",
    "feedback_updated_at",
    "suggestion_id",
    "task_id",
    "revision_id",
    "outcome",
    "attribution_linkage",
    "no_feedback",
    "edit_burden_available",
    "edit_burden_char_delta",
    "snapshot_version",
  ];
  if (mode === "detailed") {
    headers.push("output_title", "context_hash", "feedback_note");
  }

  const lines = [headers.join(",")];
  for (const r of records) {
    const draft =
      r.output.structured &&
      typeof r.output.structured === "object" &&
      "title" in (r.output.structured as object)
        ? String((r.output.structured as { title?: string }).title ?? "")
        : "";
    const row = [
      r.assistanceId,
      r.assistanceType,
      r.assistanceStatus,
      r.entityType,
      r.entityId,
      r.generatedAt,
      r.generation.provider,
      r.generation.model,
      r.generation.promptKey,
      r.generation.promptVersion,
      r.generation.contextVersion,
      r.feedback.disposition ?? "",
      r.feedback.reason ?? "",
      r.feedback.actor ?? "",
      r.feedback.createdAt ?? "",
      r.feedback.updatedAt ?? "",
      r.outcome.suggestionId ?? "",
      r.outcome.taskId ?? "",
      r.outcome.revisionId ?? "",
      r.outcome.outcome,
      r.attribution.linkage,
      r.feedback.noFeedback ? "true" : "false",
      r.editBurden.available ? "true" : "false",
      r.editBurden.characterDelta ?? "",
      String(r.snapshot.version),
    ];
    if (mode === "detailed") {
      row.push(draft, r.context.hash, r.feedback.note ?? "");
    }
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Stable id for record — assistance-scoped (no event inflation). */
export function evaluationRecordId(assistanceId: string): string {
  return `eval:${assistanceId}`;
}

export function contextFingerprint(serialized: string): string {
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

export { AI_FEEDBACK_DISPOSITIONS, AI_FEEDBACK_REASONS };
