/**
 * Content Intelligence layer (Phase 31) — read-only operational reports.
 *
 * Derived from ArticleV1 + ProductV1 + Content Graph.
 * No schema changes. No Markdown/renderer mutations.
 */
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type {
  CommerceContentSignals,
  ContentCoverageReport,
  ContentHealthReport,
  ContentIntelligenceViewModel,
  TopicCoverageLevel,
  TopicCoverageRow,
} from "@/types/content-intelligence";
import {
  buildContentGraphReport,
  buildTopicClusters,
  findUnreferencedProducts,
} from "@/lib/content-graph";
import type {
  ContentGraphArticleRef,
  ContentGraphProductRef,
} from "@/types/content-graph";

function toArticleRef(article: ArticleV1): ContentGraphArticleRef {
  return {
    articleId: article.identity.id,
    slug: article.identity.slug,
    title: article.identity.title,
    type: article.classification.type,
    status: article.publishing.status,
  };
}

function toProductRef(product: ProductV1Document): ContentGraphProductRef {
  return {
    productId: product.id,
    name: product.identity.name,
    category: product.identity.category,
  };
}

function productIdsOf(article: ArticleV1): string[] {
  return (article.products?.primary ?? []).map((r) => r.productId);
}

function classifyTopicCoverage(
  articleCount: number,
  productCount: number,
): TopicCoverageLevel {
  if (articleCount === 0) return "empty";
  if (articleCount === 1) return "needs-expansion";
  if (articleCount === 2 || productCount === 0) return "thin";
  return "good";
}

/**
 * Topic cluster coverage rows for dashboards / report:content-topics.
 */
export function buildTopicCoverageRows(
  articles: ArticleV1[],
  products: ProductV1Document[],
): TopicCoverageRow[] {
  const topics = buildTopicClusters(articles);
  const productIds = new Set(products.map((p) => p.id));

  return [...topics.values()]
    .map((topic) => {
      const productCount = topic.productIds.filter((id) => productIds.has(id)).length;
      const articleCount = topic.articleIds.length;
      return {
        topicId: topic.topicId,
        articleCount,
        productCount,
        coverage: classifyTopicCoverage(articleCount, productCount),
      };
    })
    .sort((a, b) => a.topicId.localeCompare(b.topicId));
}

/**
 * Content coverage analysis (counts only — no mutations).
 */
export function buildContentCoverageReport(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentCoverageReport {
  const published = articles.filter((a) => a.publishing.status === "published");
  const withProducts = published.filter((a) => productIdsOf(a).length > 0);
  const withoutProducts = published.filter((a) => productIdsOf(a).length === 0);
  const unreferenced = findUnreferencedProducts(articles, products);
  const topicRows = buildTopicCoverageRows(articles, products);

  return {
    articles: {
      total: articles.length,
      published: published.length,
      withProducts: withProducts.length,
      withoutProducts: withoutProducts.length,
    },
    products: {
      total: products.length,
      referenced: products.length - unreferenced.length,
      unreferenced: unreferenced.length,
    },
    topics: {
      total: topicRows.length,
      rows: topicRows,
    },
  };
}

/**
 * Commercial content signals (flags only — no mutations).
 */
export function buildCommerceSignals(
  articles: ArticleV1[],
  products: ProductV1Document[],
): CommerceContentSignals {
  const unreferenced = findUnreferencedProducts(articles, products);
  const publishedWithoutProducts = articles.filter(
    (a) =>
      a.publishing.status === "published" && productIdsOf(a).length === 0,
  );
  const highIntentWithoutCoverage = publishedWithoutProducts.filter((a) => {
    const intent = a.editorial.intent;
    return intent === "commercial" || intent === "transactional";
  });

  return {
    productWithoutArticle: unreferenced.length > 0,
    articleWithoutProduct: publishedWithoutProducts.length > 0,
    highIntentWithoutCoverage: highIntentWithoutCoverage.length > 0,
    productWithoutArticleIds: unreferenced.map((p) => p.id),
    articleWithoutProductIds: publishedWithoutProducts.map((a) => a.identity.id),
    highIntentWithoutCoverageIds: highIntentWithoutCoverage.map(
      (a) => a.identity.id,
    ),
  };
}

/**
 * Full Content Intelligence ViewModel for operators / future dashboards.
 */
export function buildContentIntelligenceViewModel(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentIntelligenceViewModel {
  const graphReport = buildContentGraphReport(articles, products);
  const coverage = buildContentCoverageReport(articles, products);
  const commercialCoverage = buildCommerceSignals(articles, products);
  const topics = [...buildTopicClusters(articles).values()].sort((a, b) =>
    a.topicId.localeCompare(b.topicId),
  );

  return {
    articles: articles.map(toArticleRef),
    products: products.map(toProductRef),
    topics,
    orphanArticles: graphReport.orphanArticles,
    orphanProducts: graphReport.productsWithoutArticles,
    topicCoverage: coverage.topics.rows,
    commercialCoverage,
    coverage,
    integrity: graphReport.integrity,
  };
}

/**
 * Content health snapshot for report:content-health.
 */
export function buildContentHealthReport(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentHealthReport {
  const intel = buildContentIntelligenceViewModel(articles, products);
  return {
    articleCount: intel.coverage.articles.total,
    productCount: intel.coverage.products.total,
    topicCount: intel.coverage.topics.total,
    orphanArticles: intel.orphanArticles,
    productsWithoutContent: intel.orphanProducts,
    topicsNeedingExpansion: intel.topicCoverage.filter(
      (t) => t.coverage === "needs-expansion" || t.coverage === "thin",
    ),
    articlesWithoutProducts: articles
      .filter(
        (a) =>
          a.publishing.status === "published" && productIdsOf(a).length === 0,
      )
      .map(toArticleRef),
    commercial: intel.commercialCoverage,
    integrity: intel.integrity,
  };
}

export type {
  CommerceContentSignals,
  ContentCoverageReport,
  ContentHealthReport,
  ContentIntelligenceViewModel,
  TopicCoverageLevel,
  TopicCoverageRow,
} from "@/types/content-intelligence";
