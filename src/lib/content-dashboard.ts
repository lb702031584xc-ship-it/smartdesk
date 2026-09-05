/**
 * Content Intelligence Dashboard read layer (Phase 32).
 *
 * Read-only service boundary for future dashboard UI.
 * No React components. No mutations. No CMS.
 *
 * Derives from `@/lib/content-intelligence` + Content Graph helpers.
 */
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type {
  ContentOverviewViewModel,
  ProductCoverageStatus,
  ProductCoverageViewModel,
  TopicHealthViewModel,
} from "@/types/content-dashboard";
import {
  buildContentIntelligenceViewModel,
  buildTopicCoverageRows,
} from "@/lib/content-intelligence";
import {
  buildTopicClusters,
  findArticlesForProduct,
} from "@/lib/content-graph";
import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";

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
 * Content overview for the future dashboard home.
 */
export function buildContentOverviewViewModel(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentOverviewViewModel {
  const intel = buildContentIntelligenceViewModel(articles, products);
  return {
    totalArticles: intel.coverage.articles.total,
    totalProducts: intel.coverage.products.total,
    totalTopics: intel.coverage.topics.total,
    publishedArticles: intel.coverage.articles.published,
    articlesWithProducts: intel.coverage.articles.withProducts,
    articlesWithoutProducts: intel.coverage.articles.withoutProducts,
    orphanArticles: intel.orphanArticles,
    productsWithoutContent: intel.orphanProducts,
    topicCoverage: intel.topicCoverage,
    commercial: intel.commercialCoverage,
    integrity: intel.integrity,
  };
}

export async function getContentOverviewViewModel(): Promise<ContentOverviewViewModel> {
  const { articles, products } = await loadCorpus();
  return buildContentOverviewViewModel(articles, products);
}

/**
 * Topic health list (all topics).
 */
export function buildTopicHealthViewModels(
  articles: ArticleV1[],
  products: ProductV1Document[],
): TopicHealthViewModel[] {
  const clusters = buildTopicClusters(articles);
  const rows = buildTopicCoverageRows(articles, products);
  const productIds = new Set(products.map((p) => p.id));

  return rows.map((row) => {
    const cluster = clusters.get(row.topicId);
    const resolvedProductIds = (cluster?.productIds ?? []).filter((id) =>
      productIds.has(id),
    );
    return {
      topic: row.topicId,
      articleCount: row.articleCount,
      productCount: row.productCount,
      coverageStatus: row.coverage,
      expansionSignal:
        row.coverage === "needs-expansion" ||
        row.coverage === "thin" ||
        row.coverage === "empty",
      articleIds: cluster?.articleIds ?? [],
      productIds: resolvedProductIds,
    };
  });
}

export function buildTopicHealthViewModel(
  topicId: string,
  articles: ArticleV1[],
  products: ProductV1Document[],
): TopicHealthViewModel | undefined {
  return buildTopicHealthViewModels(articles, products).find(
    (t) => t.topic === topicId,
  );
}

export async function getTopicHealthViewModels(): Promise<TopicHealthViewModel[]> {
  const { articles, products } = await loadCorpus();
  return buildTopicHealthViewModels(articles, products);
}

export async function getTopicHealthViewModel(
  topicId: string,
): Promise<TopicHealthViewModel | undefined> {
  const { articles, products } = await loadCorpus();
  return buildTopicHealthViewModel(topicId, articles, products);
}

function classifyProductCoverage(articleCount: number): ProductCoverageStatus {
  if (articleCount === 0) return "unreferenced";
  if (articleCount === 1) return "thin";
  return "covered";
}

/**
 * Product coverage list for future product intelligence UI.
 */
export function buildProductCoverageViewModels(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ProductCoverageViewModel[] {
  return products
    .map((product) => {
      const featuring = findArticlesForProduct(product.id, articles);
      const articleIds = featuring.map((a) => a.identity.id);
      const articleCount = articleIds.length;
      return {
        productId: product.id,
        name: product.identity.name,
        category: product.identity.category,
        hasArticles: articleCount > 0,
        articleCount,
        articleIds,
        coverageStatus: classifyProductCoverage(articleCount),
      };
    })
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export function buildProductCoverageViewModel(
  productId: string,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ProductCoverageViewModel | undefined {
  return buildProductCoverageViewModels(articles, products).find(
    (p) => p.productId === productId,
  );
}

export async function getProductCoverageViewModels(): Promise<
  ProductCoverageViewModel[]
> {
  const { articles, products } = await loadCorpus();
  return buildProductCoverageViewModels(articles, products);
}

export async function getProductCoverageViewModel(
  productId: string,
): Promise<ProductCoverageViewModel | undefined> {
  const { articles, products } = await loadCorpus();
  return buildProductCoverageViewModel(productId, articles, products);
}

export type {
  ContentOverviewViewModel,
  ProductCoverageStatus,
  ProductCoverageViewModel,
  TopicHealthViewModel,
} from "@/types/content-dashboard";
