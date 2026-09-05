/**
 * AI Recommendation scoring (Phase 41) — READ ONLY.
 *
 * Transparent scoring from existing intelligence signals.
 * No automatic actions. No mutations.
 */
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type { AISuggestionViewModel } from "@/types/ai-suggestion";
import type {
  AIRecommendationPriority,
  AIRecommendationSignal,
  AIRecommendationViewModel,
  RecommendationScoreInput,
  RecommendationScoreResult,
} from "@/types/ai-recommendation";
import type { StaleContentItemViewModel } from "@/types/editorial-activity";
import type { TopicCoverageRow } from "@/types/content-intelligence";
import {
  buildCommerceSignals,
  buildContentIntelligenceViewModel,
} from "@/lib/content-intelligence";
import { buildInternalLinkSuggestions } from "@/lib/content-graph";
import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { getPendingSuggestions } from "@/lib/ai-suggestions";
import { getStaleArticles } from "@/lib/editorial-activity";

export function priorityFromScore(score: number): AIRecommendationPriority {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

/**
 * Transparent score builder — sums signal weights, no black-box ML.
 */
export function buildRecommendationScore(
  input: RecommendationScoreInput,
): RecommendationScoreResult {
  const signalSum = input.signals.reduce((acc, s) => acc + s.weight, 0);
  let score = signalSum;

  if (input.suggestionConfidence !== undefined) {
    score += Math.round(input.suggestionConfidence * 0.15);
  }
  if (input.staleDays !== undefined && input.staleDays > 0) {
    score += Math.min(25, Math.floor(input.staleDays / 10));
  }
  if (input.commerceValue !== undefined) {
    score += Math.min(15, input.commerceValue);
  }

  score = Math.max(0, Math.min(100, score));

  const confidence =
    input.suggestionConfidence ??
    Math.min(90, 50 + Math.round(signalSum * 0.3));

  const topSignals = [...input.signals]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((s) => s.detail ?? s.label);

  const reason =
    topSignals.length > 0
      ? topSignals.join(" · ")
      : `Operational opportunity (${input.recommendationType})`;

  return {
    priorityScore: score,
    priority: priorityFromScore(score),
    confidence: Math.max(0, Math.min(100, confidence)),
    reason,
  };
}

function productRefCount(productId: string, articles: ArticleV1[]): number {
  return articles.filter((a) =>
    (a.products?.primary ?? []).some((p) => p.productId === productId),
  ).length;
}

function buildCoverageRecommendations(
  products: ProductV1Document[],
  articles: ArticleV1[],
  commerceProductIds: string[],
): AIRecommendationViewModel[] {
  const items: AIRecommendationViewModel[] = [];
  const commerceSet = new Set(commerceProductIds);

  for (const product of products) {
    const featuring = productRefCount(product.id, articles);
    if (featuring > 0) continue;

    const signals: AIRecommendationSignal[] = [
      {
        label: "product-without-article",
        weight: 65,
        detail: "Product has no supporting article",
      },
    ];
    if (commerceSet.has(product.id)) {
      signals.push({
        label: "commerce-value",
        weight: 15,
        detail: "Commercial product coverage gap",
      });
    }

    const scored = buildRecommendationScore({
      recommendationType: "content-coverage",
      signals,
      commerceValue: commerceSet.has(product.id) ? 10 : 0,
    });

    items.push({
      id: `rec:content-coverage:product:${product.id}`,
      entityType: "product",
      entityId: product.id,
      entityName: product.identity.name,
      recommendationType: "content-coverage",
      title: `${product.identity.name} — coverage gap`,
      reason: scored.reason,
      impact: "Product coverage · commerce funnel",
      signals,
      priorityScore: scored.priorityScore,
      priority: scored.priority,
      confidence: scored.confidence,
      status: "open",
      suggestionId: null,
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

function buildTopicRecommendations(
  topicRows: TopicCoverageRow[],
): AIRecommendationViewModel[] {
  const items: AIRecommendationViewModel[] = [];

  for (const row of topicRows) {
    if (row.coverage !== "thin" && row.coverage !== "needs-expansion") continue;

    const signals: AIRecommendationSignal[] = [
      {
        label: row.coverage === "thin" ? "thin-topic" : "needs-expansion",
        weight: row.coverage === "thin" ? 50 : 42,
        detail:
          row.coverage === "thin"
            ? `Topic "${row.topicId}" has thin coverage (${row.articleCount} articles)`
            : `Topic "${row.topicId}" needs expansion (${row.articleCount} article)`,
      },
    ];
    if (row.productCount === 0) {
      signals.push({
        label: "no-product-coverage",
        weight: 12,
        detail: "Topic lacks product references",
      });
    }

    const scored = buildRecommendationScore({
      recommendationType: "topic-expansion",
      signals,
    });

    items.push({
      id: `rec:topic-expansion:topic:${row.topicId}`,
      entityType: "topic",
      entityId: row.topicId,
      entityName: row.topicId,
      recommendationType: "topic-expansion",
      title: `Topic ${row.topicId} — ${row.coverage} coverage`,
      reason: scored.reason,
      impact: "Topic cluster depth",
      signals,
      priorityScore: scored.priorityScore,
      priority: scored.priority,
      confidence: scored.confidence,
      status: "open",
      suggestionId: null,
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

function buildSeoRecommendationsFromSuggestions(
  suggestions: AISuggestionViewModel[],
): AIRecommendationViewModel[] {
  return suggestions
    .filter(
      (s) =>
        s.status === "pending" &&
        (s.suggestionType === "seo" || s.targetField.startsWith("seo.")),
    )
    .map((s) => {
      const signals: AIRecommendationSignal[] = [
        {
          label: "pending-ai-suggestion",
          weight: 55,
          detail: `Pending SEO suggestion for ${s.targetField}`,
        },
        {
          label: "ai-confidence",
          weight: Math.round(s.confidence * 0.1),
          detail: `AI confidence ${s.confidence}%`,
        },
      ];

      const scored = buildRecommendationScore({
        recommendationType: "seo-improvement",
        signals,
        suggestionConfidence: s.confidence,
      });

      return {
        id: `rec:seo-improvement:${s.entityType}:${s.entityId}:${s.id}`,
        entityType: s.entityType,
        entityId: s.entityId,
        entityName: s.entityName,
        recommendationType: "seo-improvement",
        title: `SEO — ${s.targetField}`,
        reason: s.reasoning || scored.reason,
        impact: `SEO · ${s.targetField}`,
        signals,
        priorityScore: scored.priorityScore,
        priority: scored.priority,
        confidence: scored.confidence,
        status: "open",
        suggestionId: s.id,
        createdAt: s.createdAt,
      };
    });
}

function buildInternalLinkRecommendations(
  articles: ArticleV1[],
): AIRecommendationViewModel[] {
  const items: AIRecommendationViewModel[] = [];
  const published = articles.filter((a) => a.publishing.status === "published");

  for (const source of published) {
    const suggestions = buildInternalLinkSuggestions(source, articles);
    const top = suggestions.suggestedArticles.slice(0, 2);
    for (const link of top) {
      const signals: AIRecommendationSignal[] = [
        {
          label: "internal-link-opportunity",
          weight: 38,
          detail: link.reason || "Related content connection",
        },
      ];

      const scored = buildRecommendationScore({
        recommendationType: "internal-linking",
        signals,
      });

      items.push({
        id: `rec:internal-link:article:${source.identity.id}:${link.articleId}`,
        entityType: "article",
        entityId: source.identity.id,
        entityName: source.identity.title,
        recommendationType: "internal-linking",
        title: `Link to ${link.title}`,
        reason: scored.reason,
        impact: "Internal linking · topic authority",
        signals,
        priorityScore: scored.priorityScore,
        priority: scored.priority,
        confidence: scored.confidence,
        status: "open",
        suggestionId: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items;
}

function buildStaleRecommendations(
  stale: StaleContentItemViewModel[],
): AIRecommendationViewModel[] {
  return stale.slice(0, 15).map((item) => {
    const signals: AIRecommendationSignal[] = [
      {
        label: "stale-content",
        weight: 48,
        detail: `Published ${item.daysSinceUpdate} days without update`,
      },
    ];

    const scored = buildRecommendationScore({
      recommendationType: "topic-expansion",
      signals,
      staleDays: item.daysSinceUpdate,
    });

    return {
      id: `rec:stale:article:${item.entityId}`,
      entityType: "article",
      entityId: item.entityId,
      entityName: item.entityName,
      recommendationType: "topic-expansion",
      title: `${item.entityName} — stale content`,
      reason: scored.reason,
      impact: "Content freshness",
      signals,
      priorityScore: scored.priorityScore,
      priority: scored.priority,
      confidence: scored.confidence,
      status: "open",
      suggestionId: null,
      createdAt: new Date().toISOString(),
    };
  });
}

export type BuildRecommendationsResult = {
  items: AIRecommendationViewModel[];
};

async function loadCorpus(): Promise<{
  articles: ArticleV1[];
  products: ProductV1Document[];
}> {
  const articles = await listArticlesV1();
  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();
  return { articles, products };
}

/**
 * Build full recommendation set from existing intelligence (read-only).
 */
export async function buildAllRecommendations(): Promise<BuildRecommendationsResult> {
  const { articles, products } = await loadCorpus();
  const intel = buildContentIntelligenceViewModel(articles, products);
  const commerce = buildCommerceSignals(articles, products);

  const [pendingSuggestions, stale] = await Promise.all([
    getPendingSuggestions(100),
    getStaleArticles(),
  ]);

  const items: AIRecommendationViewModel[] = [
    ...buildCoverageRecommendations(
      products,
      articles,
      commerce.productWithoutArticleIds,
    ),
    ...buildTopicRecommendations(
      intel.topicCoverage.filter(
        (t) => t.coverage === "thin" || t.coverage === "needs-expansion",
      ),
    ),
    ...buildSeoRecommendationsFromSuggestions(pendingSuggestions.items),
    ...buildInternalLinkRecommendations(articles),
    ...buildStaleRecommendations(stale),
  ];

  // Deduplicate by id, keep highest score
  const byId = new Map<string, AIRecommendationViewModel>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.priorityScore > existing.priorityScore) {
      byId.set(item.id, item);
    }
  }

  const sorted = [...byId.values()].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );

  return { items: sorted };
}

export async function getTopRecommendations(
  limit = 40,
): Promise<AIRecommendationViewModel[]> {
  const { items } = await buildAllRecommendations();
  return items.slice(0, limit);
}

export async function getRecommendationsForEntity(
  entityType: "product" | "article",
  entityId: string,
): Promise<AIRecommendationViewModel[]> {
  const { items } = await buildAllRecommendations();
  return items.filter(
    (r) =>
      (r.entityType === entityType && r.entityId === entityId) ||
      (entityType === "article" &&
        r.recommendationType === "internal-linking" &&
        r.entityId === entityId),
  );
}

export type {
  AIRecommendationViewModel,
  AIRecommendationPriority,
  RecommendationScoreResult,
};
