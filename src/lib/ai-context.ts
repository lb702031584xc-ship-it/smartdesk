/**
 * AI Context builder (Phase 43) — READ ONLY.
 *
 * Assembles SmartDesk context for assistance. Never mutates canonical content.
 */
import { getAdminArticle, getAdminProduct } from "@/lib/admin";
import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  buildTopicClusters,
  findArticlesForProduct,
  resolveArticleContentGraph,
  resolveArticleTopicId,
} from "@/lib/content-graph";
import { buildContentIntelligenceViewModel } from "@/lib/content-intelligence";
import { getSuggestionsForEntity } from "@/lib/ai-suggestions";
import { getRecommendationsForEntity } from "@/lib/ai-recommendations";
import { getEntityTasks } from "@/lib/editorial-tasks";
import { getWorkflowStatus } from "@/lib/editorial-workflow";
import { getStaleArticles } from "@/lib/editorial-activity";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type {
  AIContextEntitySummary,
  AIContextRelatedRef,
  AIContextViewModel,
} from "@/types/ai-context";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

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

function articleName(article: ArticleV1): string {
  return article.identity.title || article.identity.id;
}

function productName(product: ProductV1Document): string {
  return product.identity.name || product.id;
}

function summarizeArticle(article: ArticleV1): AIContextEntitySummary {
  return {
    entityType: "article",
    entityId: article.identity.id,
    name: articleName(article),
    status: article.publishing.status ?? null,
    topicId: resolveArticleTopicId(article) ?? null,
    category: article.classification.category ?? null,
    seo: {
      metaTitle: article.seo?.metaTitle ?? null,
      metaDescription: article.seo?.metaDescription ?? null,
      primaryKeyword: article.seo?.primaryKeyword ?? null,
    },
    editorial: {
      summary: article.editorial.summary ?? null,
      intentOrRole: article.editorial.intent || null,
      verdict: null,
      bestFor: [],
    },
    commerce: {
      availability: null,
      hasAsin: false,
    },
    featuredProductIds: (article.products?.primary ?? []).map((p) => p.productId),
  };
}

function summarizeProduct(product: ProductV1Document): AIContextEntitySummary {
  return {
    entityType: "product",
    entityId: product.id,
    name: productName(product),
    status: product.commerce?.availability ?? null,
    topicId: product.identity.category ?? null,
    category: product.identity.category ?? null,
    seo: {
      metaTitle: null,
      metaDescription: null,
      primaryKeyword: null,
    },
    editorial: {
      summary: product.editorial?.description ?? null,
      intentOrRole: product.editorial?.role ?? null,
      verdict: product.editorial?.verdict ?? null,
      bestFor: product.editorial?.bestFor ?? [],
    },
    commerce: {
      availability: product.commerce?.availability ?? null,
      hasAsin: Boolean(product.commerce?.asin),
    },
    featuredProductIds: [],
  };
}

function toProductRef(product: ProductV1Document): AIContextRelatedRef {
  return { id: product.id, name: productName(product), kind: "product" };
}

function toArticleRef(article: ArticleV1): AIContextRelatedRef {
  return {
    id: article.identity.id,
    name: articleName(article),
    kind: "article",
  };
}

async function attachOperations(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<
  Pick<
    AIContextViewModel,
    "activeTasks" | "suggestions" | "recommendations" | "workflowStatus"
  >
> {
  const [tasks, suggestions, recommendations, workflow] = await Promise.all([
    getEntityTasks(entityType, entityId),
    getSuggestionsForEntity(entityType, entityId),
    getRecommendationsForEntity(entityType, entityId),
    getWorkflowStatus(entityType, entityId),
  ]);

  return {
    activeTasks: tasks.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    ),
    suggestions,
    recommendations,
    workflowStatus: workflow?.record.status ?? null,
  };
}

/**
 * Compact prompt payload — summaries and IDs only, not full canonical docs.
 */
export function serializeAIPromptContext(context: AIContextViewModel): string {
  return JSON.stringify(
    {
      entityType: context.entityType,
      entityId: context.entityId,
      name: context.entity.name,
      status: context.entity.status,
      topic: context.topic,
      seo: context.entity.seo,
      editorial: context.entity.editorial,
      commerce: context.entity.commerce,
      relatedProducts: context.relatedProducts.map((r) => r.id),
      relatedArticles: context.relatedArticles.map((r) => r.id),
      signals: context.intelligenceSignals,
      pendingSuggestions: context.suggestions.filter((s) => s.status === "pending")
        .length,
      activeTasks: context.activeTasks.length,
      recommendations: context.recommendations.map((r) => r.recommendationType),
      workflowStatus: context.workflowStatus,
    },
    null,
    2,
  );
}

export async function buildArticleAIContext(
  articleId: string,
): Promise<AIContextViewModel | null> {
  const record = await getAdminArticle(articleId);
  if (!record) return null;

  const article = record.article;
  const { articles, products } = await loadCorpus();
  const graph = resolveArticleContentGraph(article, articles, products);
  const intel = buildContentIntelligenceViewModel(articles, products);
  const stale = await getStaleArticles();
  const ops = await attachOperations("article", articleId);

  const topicRow = graph.topic
    ? intel.topicCoverage.find((t) => t.topicId === graph.topic!.topicId)
    : undefined;

  const intelligenceSignals: string[] = [];
  if (graph.products.length === 0) {
    intelligenceSignals.push("article-without-product");
  }
  if (graph.relatedArticles.length === 0) {
    intelligenceSignals.push("missing-related-articles");
  }
  if (
    topicRow &&
    (topicRow.coverage === "thin" || topicRow.coverage === "needs-expansion")
  ) {
    intelligenceSignals.push(`topic-${topicRow.coverage}`);
  }
  if (stale.some((s) => s.entityId === articleId)) {
    intelligenceSignals.push("stale-content");
  }
  if (!article.seo?.metaTitle || !article.seo?.metaDescription) {
    intelligenceSignals.push("incomplete-seo");
  }
  if (ops.suggestions.some((s) => s.status === "pending")) {
    intelligenceSignals.push("pending-ai-suggestion");
  }

  return {
    entityType: "article",
    entityId: articleId,
    entity: summarizeArticle(article),
    relatedProducts: graph.products.slice(0, 12).map(toProductRef),
    relatedArticles: graph.relatedArticles.slice(0, 12).map(toArticleRef),
    topic: graph.topic
      ? {
          topicId: graph.topic.topicId,
          articleCount: graph.topic.articleIds.length,
          productCount: graph.topic.productIds.length,
          coverage: topicRow?.coverage ?? null,
        }
      : null,
    intelligenceSignals,
    ...ops,
  };
}

export async function buildProductAIContext(
  productId: string,
): Promise<AIContextViewModel | null> {
  const record = await getAdminProduct(productId);
  if (!record) return null;

  const product = record.product;
  const { articles, products } = await loadCorpus();
  const featuring = findArticlesForProduct(productId, articles);
  const topics = buildTopicClusters(articles);
  const intel = buildContentIntelligenceViewModel(articles, products);
  const ops = await attachOperations("product", productId);

  const relatedIds = product.relationships?.relatedProducts ?? [];
  const relatedProducts = relatedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is ProductV1Document => Boolean(p))
    .map(toProductRef);

  const topicId = product.identity.category ?? null;
  const cluster = topicId ? topics.get(topicId) : undefined;
  const topicRow = topicId
    ? intel.topicCoverage.find((t) => t.topicId === topicId)
    : undefined;

  const intelligenceSignals: string[] = [];
  if (featuring.length === 0) {
    intelligenceSignals.push("product-without-article");
  }
  if (!product.editorial?.verdict) {
    intelligenceSignals.push("missing-verdict");
  }
  if ((product.editorial?.bestFor ?? []).length === 0) {
    intelligenceSignals.push("missing-best-for");
  }
  if (
    topicRow &&
    (topicRow.coverage === "thin" || topicRow.coverage === "needs-expansion")
  ) {
    intelligenceSignals.push(`topic-${topicRow.coverage}`);
  }
  if (ops.suggestions.some((s) => s.status === "pending")) {
    intelligenceSignals.push("pending-ai-suggestion");
  }
  if (ops.recommendations.some((r) => r.priority === "high")) {
    intelligenceSignals.push("high-priority-recommendation");
  }

  return {
    entityType: "product",
    entityId: productId,
    entity: summarizeProduct(product),
    relatedProducts,
    relatedArticles: featuring.slice(0, 12).map(toArticleRef),
    topic: cluster
      ? {
          topicId: cluster.topicId,
          articleCount: cluster.articleIds.length,
          productCount: cluster.productIds.length,
          coverage: topicRow?.coverage ?? null,
        }
      : topicId
        ? {
            topicId,
            articleCount: featuring.length,
            productCount: 1,
            coverage: topicRow?.coverage ?? null,
          }
        : null,
    intelligenceSignals,
    ...ops,
  };
}

export async function buildWorkspaceAIContext(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<AIContextViewModel | null> {
  if (entityType === "article") {
    return buildArticleAIContext(entityId);
  }
  return buildProductAIContext(entityId);
}
