/**
 * Content Intelligence Dashboard read-layer validation (Phase 32).
 * Usage: npm run validate:content-dashboard
 *
 * Ensures dashboard ViewModels resolve and match intelligence reports.
 * Read-only — no mutations.
 */
import "./load-env-local";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import {
  buildContentCoverageReport,
  buildContentIntelligenceViewModel,
} from "../src/lib/content-intelligence";
import {
  buildContentOverviewViewModel,
  buildProductCoverageViewModels,
  buildTopicHealthViewModels,
  getContentOverviewViewModel,
} from "../src/lib/content-dashboard";
import { findArticlesForProduct, validateContentGraphIntegrity } from "../src/lib/content-graph";
import { closeDb } from "../src/lib/db/client";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

async function main() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();

  console.log("=== Integrity ===");
  const integrity = validateContentGraphIntegrity(articles, products);
  assert(integrity.valid, "no broken graph references");

  console.log("=== ContentOverviewViewModel ===");
  const overview = buildContentOverviewViewModel(articles, products);
  const coverage = buildContentCoverageReport(articles, products);
  const intel = buildContentIntelligenceViewModel(articles, products);

  assert(overview.totalArticles === coverage.articles.total, "overview articles");
  assert(overview.totalProducts === coverage.products.total, "overview products");
  assert(overview.totalTopics === coverage.topics.total, "overview topics");
  assert(
    overview.publishedArticles === coverage.articles.published,
    "overview published",
  );
  assert(
    overview.articlesWithProducts === coverage.articles.withProducts,
    "overview with products",
  );
  assert(
    overview.articlesWithoutProducts === coverage.articles.withoutProducts,
    "overview without products",
  );
  assert(
    overview.orphanArticles.length === intel.orphanArticles.length,
    "overview orphans match intel",
  );
  assert(
    overview.productsWithoutContent.length === intel.orphanProducts.length,
    "overview products without content",
  );
  assert(
    overview.topicCoverage.length === coverage.topics.rows.length,
    "overview topic coverage rows",
  );
  assert(overview.integrity.valid === integrity.valid, "overview integrity");

  const asyncOverview = await getContentOverviewViewModel();
  assert(
    asyncOverview.totalArticles === overview.totalArticles,
    "async overview matches sync",
  );

  console.log("=== TopicHealthViewModel ===");
  const topics = buildTopicHealthViewModels(articles, products);
  assert(topics.length === overview.totalTopics, "topic health count");
  assert(
    topics.every(
      (t) =>
        typeof t.topic === "string" &&
        typeof t.articleCount === "number" &&
        typeof t.productCount === "number" &&
        typeof t.coverageStatus === "string" &&
        typeof t.expansionSignal === "boolean" &&
        Array.isArray(t.articleIds) &&
        Array.isArray(t.productIds),
    ),
    "topic health shape",
  );
  for (const row of overview.topicCoverage) {
    const health = topics.find((t) => t.topic === row.topicId);
    assert(Boolean(health), `topic health for ${row.topicId}`);
    assert(health!.articleCount === row.articleCount, `${row.topicId} articleCount`);
    assert(health!.productCount === row.productCount, `${row.topicId} productCount`);
    assert(health!.coverageStatus === row.coverage, `${row.topicId} coverageStatus`);
    assert(
      health!.expansionSignal ===
        (row.coverage === "needs-expansion" ||
          row.coverage === "thin" ||
          row.coverage === "empty"),
      `${row.topicId} expansionSignal`,
    );
  }

  console.log("=== ProductCoverageViewModel ===");
  const productCoverage = buildProductCoverageViewModels(articles, products);
  assert(productCoverage.length === products.length, "product coverage count");
  for (const product of products) {
    const row = productCoverage.find((p) => p.productId === product.id);
    assert(Boolean(row), `coverage row for ${product.id}`);
    const featuring = findArticlesForProduct(product.id, articles);
    assert(row!.articleCount === featuring.length, `${product.id} articleCount`);
    assert(row!.hasArticles === featuring.length > 0, `${product.id} hasArticles`);
    assert(
      row!.coverageStatus ===
        (featuring.length === 0
          ? "unreferenced"
          : featuring.length === 1
            ? "thin"
            : "covered"),
      `${product.id} coverageStatus`,
    );
  }

  const unreferenced = productCoverage.filter((p) => !p.hasArticles);
  assert(
    unreferenced.length === overview.productsWithoutContent.length,
    "unreferenced products match overview",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Content dashboard validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
