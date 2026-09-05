/**
 * AI Recommendation resolver (Phase 41) — READ ONLY dashboard wrappers.
 */
import {
  buildAllRecommendations,
  getRecommendationsForEntity,
  getTopRecommendations,
} from "@/lib/ai-recommendations";
import type {
  AIRecommendationQueueViewModel,
  AIRecommendationViewModel,
} from "@/types/ai-recommendation";

export async function getRecommendationQueue(
  limit = 50,
): Promise<AIRecommendationQueueViewModel> {
  const { items: all } = await buildAllRecommendations();
  const items = all.slice(0, limit);

  const high = items.filter((i) => i.priority === "high");
  const medium = items.filter((i) => i.priority === "medium");
  const low = items.filter((i) => i.priority === "low");

  return {
    totalCount: items.length,
    highCount: high.length,
    mediumCount: medium.length,
    lowCount: low.length,
    items,
    byPriority: { high, medium, low },
  };
}

export async function getEntityRecommendations(
  entityType: "product" | "article",
  entityId: string,
): Promise<AIRecommendationViewModel[]> {
  return getRecommendationsForEntity(entityType, entityId);
}

export { getTopRecommendations, getRecommendationsForEntity };

export type { AIRecommendationQueueViewModel, AIRecommendationViewModel };
