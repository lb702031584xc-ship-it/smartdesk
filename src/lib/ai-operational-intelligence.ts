/**
 * AI Operational Intelligence read model (Phase 44).
 *
 * Observational only. Does not change prompts, scores, priorities,
 * suggestions, tasks, or canonical content.
 */

import { isDatabaseContentStore } from "@/lib/content/store-config";
import { buildAllRecommendations } from "@/lib/ai-recommendations";
import {
  getAIOutcomeSummary,
  getAIOutcomes,
  getEntityAIOutcomes,
  getRecommendationTaskOutcomes,
  getSuggestionOutcomes,
  buildAssistanceTypePerformance,
} from "@/lib/ai-outcomes";
import { listAllAIAssistance } from "@/lib/ai-assistance-store";
import type {
  AIOperationalOverview,
  AssistanceTypePerformance,
  EntityAIOutcomeSummary,
  RecommendationOutcomeViewModel,
  SuggestionOutcomeViewModel,
} from "@/types/ai-outcome";
import type { AIOutcomeEntityType } from "@/types/ai-outcome";

export async function getAIOperationalOverview(
  limit = 120,
): Promise<AIOperationalOverview> {
  const [metrics, recentOutcomes, suggestionOutcomes, liveRecs] =
    await Promise.all([
      getAIOutcomeSummary(limit),
      getAIOutcomes(limit),
      getSuggestionOutcomes(limit),
      isDatabaseContentStore()
        ? buildAllRecommendations().catch(() => ({ items: [] as Array<{ id: string; priority: "high" | "medium" | "low" }> }))
        : Promise.resolve({ items: [] as Array<{ id: string; priority: "high" | "medium" | "low" }> }),
    ]);

  const recommendationConversions = await getRecommendationTaskOutcomes(
    liveRecs.items.map((r) => ({ id: r.id, priority: r.priority })),
    limit,
  );

  const convertedToTasks = recommendationConversions.filter(
    (r) => r.taskCreated,
  ).length;
  const tasksStillOpen = recommendationConversions.filter(
    (r) =>
      r.taskStatus === "open" ||
      r.taskStatus === "in-progress" ||
      r.taskStatus === "review",
  ).length;
  const tasksCompleted = recommendationConversions.filter(
    (r) => r.conversion === "completed",
  ).length;
  const notConverted = recommendationConversions.filter(
    (r) => r.conversion === "not-converted",
  ).length;

  return {
    metrics,
    recentOutcomes,
    assistancePerformance: metrics.byAssistanceType,
    recommendationConversions,
    suggestionOutcomes,
    recommendationMetrics: {
      convertedToTasks,
      tasksStillOpen,
      tasksCompleted,
      liveRecommendations: liveRecs.items.length,
      notConverted,
    },
    suggestionMetrics: {
      pending: suggestionOutcomes.filter((s) => s.status === "pending").length,
      accepted: suggestionOutcomes.filter((s) => s.status === "accepted")
        .length,
      rejected: suggestionOutcomes.filter((s) => s.status === "rejected")
        .length,
      expired: suggestionOutcomes.filter((s) => s.status === "expired").length,
      applied: suggestionOutcomes.filter((s) => s.applied).length,
      acceptedAdvisory: suggestionOutcomes.filter(
        (s) => s.outcome === "accepted-advisory",
      ).length,
    },
  };
}

export async function getAIAssistancePerformance(
  limit = 200,
): Promise<AssistanceTypePerformance[]> {
  if (!isDatabaseContentStore()) {
    return buildAssistanceTypePerformance([]);
  }
  const rows = await listAllAIAssistance(limit);
  return buildAssistanceTypePerformance(rows);
}

export async function getRecommendationConversionMetrics(
  limit = 200,
): Promise<{
  items: RecommendationOutcomeViewModel[];
  convertedToTasks: number;
  tasksStillOpen: number;
  tasksCompleted: number;
  notConverted: number;
}> {
  const live = isDatabaseContentStore()
    ? await buildAllRecommendations().catch(() => ({ items: [] as Array<{ id: string; priority: "high" | "medium" | "low" }> }))
    : { items: [] as Array<{ id: string; priority: "high" | "medium" | "low" }> };

  const items = await getRecommendationTaskOutcomes(
    live.items.map((r) => ({ id: r.id, priority: r.priority })),
    limit,
  );

  return {
    items,
    convertedToTasks: items.filter((r) => r.taskCreated).length,
    tasksStillOpen: items.filter(
      (r) =>
        r.taskStatus === "open" ||
        r.taskStatus === "in-progress" ||
        r.taskStatus === "review",
    ).length,
    tasksCompleted: items.filter((r) => r.conversion === "completed").length,
    notConverted: items.filter((r) => r.conversion === "not-converted").length,
  };
}

export async function getSuggestionOutcomeMetrics(
  limit = 200,
): Promise<{
  items: SuggestionOutcomeViewModel[];
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  applied: number;
  acceptedAdvisory: number;
}> {
  const items = await getSuggestionOutcomes(limit);
  return {
    items,
    pending: items.filter((s) => s.status === "pending").length,
    accepted: items.filter((s) => s.status === "accepted").length,
    rejected: items.filter((s) => s.status === "rejected").length,
    expired: items.filter((s) => s.status === "expired").length,
    applied: items.filter((s) => s.applied).length,
    acceptedAdvisory: items.filter((s) => s.outcome === "accepted-advisory")
      .length,
  };
}

export async function getEntityOperationalSummary(
  entityType: AIOutcomeEntityType,
  entityId: string,
): Promise<EntityAIOutcomeSummary> {
  return getEntityAIOutcomes(entityType, entityId);
}
