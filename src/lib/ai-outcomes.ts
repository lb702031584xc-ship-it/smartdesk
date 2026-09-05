/**
 * AI Outcome resolver (Phase 44).
 *
 * Read-only. Resolves outcomes only from durable stored links.
 * Unknown relationships remain explicitly unknown — no inferred causality.
 */

import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  findAIAssistanceById,
  listAIAssistanceByEntity,
  listAllAIAssistance,
} from "@/lib/ai-assistance-store";
import {
  findAISuggestionById,
  listAISuggestionsByEntity,
  listAllAISuggestions,
} from "@/lib/ai-suggestions-store";
import {
  findEditorialTaskById,
  listAllEditorialTasks,
  listEditorialTasksByEntity,
} from "@/lib/editorial-tasks-store";
import { getWorkflowStatus } from "@/lib/editorial-workflow";
import type { AIAssistanceRecord, AIAssistanceType } from "@/types/ai-assistance";
import type { AISuggestionRecord } from "@/types/ai-suggestion";
import type { EditorialTaskRecord } from "@/types/editorial-task";
import type {
  AIOperationalMetricsViewModel,
  AIOutcomeEntityType,
  AIOutcomeProvenanceHop,
  AIOutcomeValue,
  AIOutcomeViewModel,
  AssistanceQualitySignal,
  AssistanceTypePerformance,
  EntityAIOutcomeSummary,
  RecommendationConversionState,
  RecommendationOutcomeViewModel,
  SuggestionOutcomeViewModel,
} from "@/types/ai-outcome";
import type { AIRecommendationPriority } from "@/types/ai-recommendation";

const ASSISTANCE_TYPES: readonly AIAssistanceType[] = [
  "seo",
  "content-improvement",
  "product-editorial",
  "internal-link",
] as const;

const MIN_SAMPLES_FOR_SIGNAL = 5;

function nowIso(): string {
  return new Date().toISOString();
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function qualitySignalForRate(
  generated: number,
  acceptanceRate: number | null,
): AssistanceQualitySignal {
  if (generated < MIN_SAMPLES_FOR_SIGNAL || acceptanceRate === null) {
    return "insufficient-data";
  }
  if (acceptanceRate >= 0.7) return "high-acceptance";
  if (acceptanceRate <= 0.3) return "low-acceptance";
  return "mixed";
}

async function loadEntityWorkflow(
  entityType: string,
  entityId: string,
): Promise<AIOutcomeViewModel["workflowStatus"]> {
  if (entityType !== "article" && entityType !== "product") return null;
  try {
    const view = await getWorkflowStatus(entityType, entityId);
    return view?.record.status ?? null;
  } catch {
    return null;
  }
}

function resolveSuggestionOutcomeValue(
  suggestion: AISuggestionRecord,
): AIOutcomeValue {
  if (suggestion.status === "pending") return "pending";
  if (suggestion.status === "rejected" || suggestion.status === "expired") {
    return "rejected";
  }
  if (suggestion.status === "accepted") {
    if (suggestion.mutationRevisionId) return "applied";
    return "accepted-advisory";
  }
  return "unknown";
}

function buildSuggestionProvenance(
  suggestion: AISuggestionRecord,
): AIOutcomeProvenanceHop[] {
  const hops: AIOutcomeProvenanceHop[] = [
    {
      kind: "ai-suggestion",
      id: suggestion.id,
      label: `${suggestion.suggestionType} → ${suggestion.targetField}`,
      status: suggestion.status,
    },
  ];
  if (suggestion.mutationRevisionId) {
    hops.push({
      kind: "revision",
      id: suggestion.mutationRevisionId,
      label: "mutation revision (stored on suggestion)",
      status: "recorded",
    });
  }
  return hops;
}

/**
 * Resolve a single assistance record into an outcome using durable IDs only.
 */
export async function resolveAIAssistanceOutcome(
  assistance: AIAssistanceRecord,
): Promise<AIOutcomeViewModel> {
  const provenance: AIOutcomeProvenanceHop[] = [
    {
      kind: "ai-assistance",
      id: assistance.id,
      label: assistance.type,
      status: assistance.status,
    },
  ];

  const workflowStatus = await loadEntityWorkflow(
    assistance.entityType,
    assistance.entityId,
  );

  const base: Omit<AIOutcomeViewModel, "outcome" | "downstreamType" | "downstreamId" | "downstreamStatus" | "canonicalChangeObserved" | "revisionId" | "provenance"> & {
    provenance: AIOutcomeProvenanceHop[];
  } = {
    sourceType: "ai-assistance",
    sourceId: assistance.id,
    entityType: assistance.entityType,
    entityId: assistance.entityId,
    assistanceType: assistance.type,
    assistanceStatus: assistance.status,
    workflowStatus,
    provenance,
    timestamps: {
      sourceCreatedAt: assistance.createdAt,
      sourceReviewedAt: assistance.reviewedAt,
      resolvedAt: nowIso(),
    },
  };

  if (assistance.status === "draft" || assistance.status === "reviewed") {
    return {
      ...base,
      downstreamType: null,
      downstreamId: null,
      downstreamStatus: null,
      canonicalChangeObserved: false,
      revisionId: null,
      outcome: "pending",
      provenance,
    };
  }

  if (assistance.status === "rejected") {
    return {
      ...base,
      downstreamType: null,
      downstreamId: null,
      downstreamStatus: null,
      canonicalChangeObserved: false,
      revisionId: null,
      outcome: "rejected",
      provenance,
    };
  }

  // accepted — follow durable suggestion_id / task_id only
  if (assistance.suggestionId) {
    const suggestion = await findAISuggestionById(assistance.suggestionId);
    if (!suggestion) {
      provenance.push({
        kind: "ai-suggestion",
        id: assistance.suggestionId,
        label: "linked suggestion missing",
        status: null,
      });
      return {
        ...base,
        downstreamType: "ai-suggestion",
        downstreamId: assistance.suggestionId,
        downstreamStatus: null,
        canonicalChangeObserved: false,
        revisionId: null,
        outcome: "unknown",
        provenance,
      };
    }

    provenance.push({
      kind: "ai-suggestion",
      id: suggestion.id,
      label: `${suggestion.suggestionType} → ${suggestion.targetField}`,
      status: suggestion.status,
    });

    let outcome: AIOutcomeValue = "converted-to-suggestion";
    let revisionId: string | null = null;
    let canonicalChangeObserved = false;

    if (suggestion.status === "rejected" || suggestion.status === "expired") {
      outcome = "rejected";
    } else if (suggestion.status === "accepted") {
      if (suggestion.mutationRevisionId) {
        revisionId = suggestion.mutationRevisionId;
        canonicalChangeObserved = true;
        outcome = "applied";
        provenance.push({
          kind: "revision",
          id: suggestion.mutationRevisionId,
          label: "mutation revision (suggestion.mutation_revision_id)",
          status: "recorded",
        });
        // Entity workflow publish is not AI-linked — report status only, do not claim published.
      } else {
        outcome = "accepted-advisory";
      }
    } else if (suggestion.status === "pending") {
      outcome = "converted-to-suggestion";
    } else {
      outcome = "unknown";
    }

    return {
      ...base,
      downstreamType: "ai-suggestion",
      downstreamId: suggestion.id,
      downstreamStatus: suggestion.status,
      canonicalChangeObserved,
      revisionId,
      outcome,
      provenance,
    };
  }

  if (assistance.taskId) {
    const task = await findEditorialTaskById(assistance.taskId);
    if (!task) {
      provenance.push({
        kind: "editorial-task",
        id: assistance.taskId,
        label: "linked task missing",
        status: null,
      });
      return {
        ...base,
        downstreamType: "editorial-task",
        downstreamId: assistance.taskId,
        downstreamStatus: null,
        canonicalChangeObserved: false,
        revisionId: null,
        outcome: "unknown",
        provenance,
      };
    }

    provenance.push({
      kind: "editorial-task",
      id: task.id,
      label: task.title,
      status: task.status,
    });

    const outcome: AIOutcomeValue =
      task.status === "completed"
        ? "completed"
        : task.status === "cancelled"
          ? "rejected"
          : "converted-to-task";

    return {
      ...base,
      downstreamType: "editorial-task",
      downstreamId: task.id,
      downstreamStatus: task.status,
      canonicalChangeObserved: false,
      revisionId: null,
      outcome,
      provenance,
    };
  }

  // Accepted without durable downstream link
  provenance.push({
    kind: "ai-assistance",
    id: assistance.id,
    label: "accepted without suggestion_id or task_id",
    status: assistance.status,
  });
  return {
    ...base,
    downstreamType: null,
    downstreamId: null,
    downstreamStatus: null,
    canonicalChangeObserved: false,
    revisionId: null,
    outcome: "unknown",
    provenance,
  };
}

export async function getAIOutcomes(
  limit = 100,
): Promise<AIOutcomeViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listAllAIAssistance(limit);
  const outcomes = await Promise.all(rows.map(resolveAIAssistanceOutcome));
  return outcomes;
}

export async function getEntityAIOutcomes(
  entityType: AIOutcomeEntityType,
  entityId: string,
): Promise<EntityAIOutcomeSummary> {
  if (!isDatabaseContentStore()) {
    return {
      entityType,
      entityId,
      assistanceCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      tasksCompleted: 0,
      suggestionsApplied: 0,
      outcomes: [],
    };
  }

  const rows = await listAIAssistanceByEntity(entityType, entityId);
  const outcomes = await Promise.all(rows.map(resolveAIAssistanceOutcome));

  const acceptedCount = outcomes.filter(
    (o) => o.assistanceStatus === "accepted",
  ).length;
  const rejectedCount = outcomes.filter(
    (o) => o.assistanceStatus === "rejected",
  ).length;
  const pendingCount = outcomes.filter(
    (o) =>
      o.assistanceStatus === "draft" || o.assistanceStatus === "reviewed",
  ).length;
  const tasksCompleted = outcomes.filter((o) => o.outcome === "completed").length;
  const suggestionsApplied = outcomes.filter(
    (o) => o.outcome === "applied",
  ).length;

  return {
    entityType,
    entityId,
    assistanceCount: outcomes.length,
    acceptedCount,
    rejectedCount,
    pendingCount,
    tasksCompleted,
    suggestionsApplied,
    outcomes,
  };
}

export function buildAssistanceTypePerformance(
  rows: AIAssistanceRecord[],
): AssistanceTypePerformance[] {
  return ASSISTANCE_TYPES.map((assistanceType) => {
    const subset = rows.filter((r) => r.type === assistanceType);
    const accepted = subset.filter((r) => r.status === "accepted").length;
    const rejected = subset.filter((r) => r.status === "rejected").length;
    const pending = subset.filter(
      (r) => r.status === "draft" || r.status === "reviewed",
    ).length;
    const decided = accepted + rejected;
    const acceptanceRate = rate(accepted, decided);
    return {
      assistanceType,
      generated: subset.length,
      accepted,
      rejected,
      pending,
      acceptanceRate,
      signal: qualitySignalForRate(subset.length, acceptanceRate),
    };
  });
}

export async function getAIOutcomeSummary(
  limit = 200,
): Promise<AIOperationalMetricsViewModel> {
  if (!isDatabaseContentStore()) {
    return {
      totalAssistance: 0,
      pendingAssistance: 0,
      acceptedAssistance: 0,
      rejectedAssistance: 0,
      acceptanceRate: null,
      suggestionsCreated: 0,
      tasksCreated: 0,
      suggestionsApplied: 0,
      tasksCompleted: 0,
      publishedOutcomes: 0,
      byAssistanceType: buildAssistanceTypePerformance([]),
    };
  }

  const rows = await listAllAIAssistance(limit);
  const outcomes = await Promise.all(rows.map(resolveAIAssistanceOutcome));

  const pendingAssistance = rows.filter(
    (r) => r.status === "draft" || r.status === "reviewed",
  ).length;
  const acceptedAssistance = rows.filter((r) => r.status === "accepted").length;
  const rejectedAssistance = rows.filter((r) => r.status === "rejected").length;
  const decided = acceptedAssistance + rejectedAssistance;

  const suggestionsCreated = outcomes.filter(
    (o) => o.downstreamType === "ai-suggestion" && o.downstreamId !== null,
  ).length;
  const tasksCreated = outcomes.filter(
    (o) => o.downstreamType === "editorial-task" && o.downstreamId !== null,
  ).length;
  const suggestionsApplied = outcomes.filter(
    (o) => o.outcome === "applied",
  ).length;
  const tasksCompleted = outcomes.filter(
    (o) => o.outcome === "completed",
  ).length;
  const publishedOutcomes = outcomes.filter(
    (o) => o.outcome === "published",
  ).length;

  return {
    totalAssistance: rows.length,
    pendingAssistance,
    acceptedAssistance,
    rejectedAssistance,
    acceptanceRate: rate(acceptedAssistance, decided),
    suggestionsCreated,
    tasksCreated,
    suggestionsApplied,
    tasksCompleted,
    publishedOutcomes,
    byAssistanceType: buildAssistanceTypePerformance(rows),
  };
}

export function resolveSuggestionOutcome(
  suggestion: AISuggestionRecord,
): SuggestionOutcomeViewModel {
  const outcome = resolveSuggestionOutcomeValue(suggestion);
  return {
    suggestionId: suggestion.id,
    entityType: suggestion.entityType,
    entityId: suggestion.entityId,
    status: suggestion.status,
    mutationRevisionId: suggestion.mutationRevisionId,
    applied: Boolean(suggestion.mutationRevisionId),
    outcome,
    provenance: buildSuggestionProvenance(suggestion),
  };
}

export async function getSuggestionOutcomes(
  limit = 200,
): Promise<SuggestionOutcomeViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listAllAISuggestions(limit);
  return rows.map(resolveSuggestionOutcome);
}

function conversionFromTask(
  task: EditorialTaskRecord | null,
): RecommendationConversionState {
  if (!task) return "not-converted";
  if (task.status === "completed") return "completed";
  if (
    task.status === "open" ||
    task.status === "in-progress" ||
    task.status === "review"
  ) {
    return "pending";
  }
  // cancelled — still converted historically, but not completed
  return "converted";
}

/**
 * Recommendation → task tracking using durable task.source_type / source_id.
 * Live recommendations without a task are reported as not-converted.
 */
export function buildRecommendationOutcomes(input: {
  liveRecommendationIds: Array<{
    id: string;
    priority: AIRecommendationPriority | null;
  }>;
  tasks: EditorialTaskRecord[];
}): RecommendationOutcomeViewModel[] {
  const recTasks = input.tasks.filter(
    (t) => t.sourceType === "ai-recommendation" && t.sourceId,
  );

  const bySourceId = new Map<string, EditorialTaskRecord>();
  for (const task of recTasks) {
    if (!task.sourceId) continue;
    const existing = bySourceId.get(task.sourceId);
    // Prefer completed, else newest by updatedAt
    if (
      !existing ||
      (task.status === "completed" && existing.status !== "completed") ||
      task.updatedAt > existing.updatedAt
    ) {
      bySourceId.set(task.sourceId, task);
    }
  }

  const seen = new Set<string>();
  const results: RecommendationOutcomeViewModel[] = [];

  for (const rec of input.liveRecommendationIds) {
    seen.add(rec.id);
    const task = bySourceId.get(rec.id) ?? null;
    results.push({
      recommendationId: rec.id,
      priority: rec.priority,
      taskCreated: Boolean(task),
      taskId: task?.id ?? null,
      taskStatus: task?.status ?? null,
      conversion: conversionFromTask(task),
    });
  }

  // Historical tasks whose live recommendation may no longer resolve
  for (const [sourceId, task] of bySourceId) {
    if (seen.has(sourceId)) continue;
    results.push({
      recommendationId: sourceId,
      priority: task.priority,
      taskCreated: true,
      taskId: task.id,
      taskStatus: task.status,
      conversion: conversionFromTask(task),
    });
  }

  return results;
}

export async function getRecommendationTaskOutcomes(
  liveRecommendations: Array<{
    id: string;
    priority: AIRecommendationPriority | null;
  }>,
  limit = 200,
): Promise<RecommendationOutcomeViewModel[]> {
  if (!isDatabaseContentStore()) {
    return liveRecommendations.map((r) => ({
      recommendationId: r.id,
      priority: r.priority,
      taskCreated: false,
      taskId: null,
      taskStatus: null,
      conversion: "not-converted" as const,
    }));
  }
  const tasks = await listAllEditorialTasks(limit);
  return buildRecommendationOutcomes({
    liveRecommendationIds: liveRecommendations,
    tasks,
  });
}

/** Entity-scoped tasks with AI provenance (for workspace summaries). */
export async function getEntityTaskCompletionStats(
  entityType: AIOutcomeEntityType,
  entityId: string,
): Promise<{ tasksCompleted: number; suggestionsApplied: number }> {
  if (!isDatabaseContentStore()) {
    return { tasksCompleted: 0, suggestionsApplied: 0 };
  }
  const [tasks, suggestions] = await Promise.all([
    listEditorialTasksByEntity(entityType, entityId),
    listAISuggestionsByEntity(entityType, entityId),
  ]);
  return {
    tasksCompleted: tasks.filter((t) => t.status === "completed").length,
    suggestionsApplied: suggestions.filter(
      (s) => s.status === "accepted" && Boolean(s.mutationRevisionId),
    ).length,
  };
}

export async function findAssistanceOutcomeById(
  assistanceId: string,
): Promise<AIOutcomeViewModel | null> {
  if (!isDatabaseContentStore()) return null;
  const row = await findAIAssistanceById(assistanceId);
  if (!row) return null;
  return resolveAIAssistanceOutcome(row);
}
