/**
 * Content Intelligence validation (Phase 31).
 * Usage: npm run validate:content-intelligence
 *
 * Read-only. Counts must match graph-derived sources.
 */
import "./load-env-local";
import {
  buildContentGraphReport,
  findUnreferencedProducts,
  validateContentGraphIntegrity,
} from "../src/lib/content-graph";
import {
  buildCommerceSignals,
  buildContentCoverageReport,
  buildContentHealthReport,
  buildContentIntelligenceViewModel,
  buildTopicCoverageRows,
} from "../src/lib/content-intelligence";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { listFilesystemProductsV1 } from "../src/lib/content/filesystem-products";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";

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
  const fsProducts = listFilesystemProductsV1();

  console.log("=== Graph resolves / integrity ===");
  const integrity = validateContentGraphIntegrity(articles, products);
  assert(integrity.valid, "no broken graph references");

  console.log("=== Coverage report ===");
  const coverage = buildContentCoverageReport(articles, products);
  assert(coverage.articles.total === articles.length, "article total matches");
  assert(coverage.products.total === products.length, "product total matches");
  assert(
    coverage.articles.withProducts + coverage.articles.withoutProducts ===
      coverage.articles.published,
    "published product coverage partitions",
  );
  assert(
    coverage.products.referenced + coverage.products.unreferenced ===
      coverage.products.total,
    "product reference partitions",
  );
  assert(
    coverage.products.unreferenced ===
      findUnreferencedProducts(articles, products).length,
    "unreferenced count matches graph helper",
  );

  console.log("=== Topic aggregation ===");
  const topicRows = buildTopicCoverageRows(articles, products);
  assert(topicRows.length === coverage.topics.total, "topic row count");
  assert(
    topicRows.every((r) =>
      ["good", "thin", "needs-expansion", "empty"].includes(r.coverage),
    ),
    "topic coverage levels valid",
  );
  const sparse = topicRows.filter((r) => r.articleCount < 2);
  for (const row of sparse) {
    assert(
      row.coverage === "needs-expansion" ||
        row.coverage === "thin" ||
        row.coverage === "empty",
      `sparse topic ${row.topicId} not marked good`,
    );
  }

  console.log("=== Orphan / product coverage ===");
  const graphReport = buildContentGraphReport(articles, products);
  const intel = buildContentIntelligenceViewModel(articles, products);
  assert(
    intel.orphanArticles.length === graphReport.orphanArticles.length,
    "orphan articles align with graph report",
  );
  assert(
    intel.orphanProducts.length === graphReport.productsWithoutArticles.length,
    "orphan products align with graph report",
  );
  assert(intel.articles.length === articles.length, "intel lists all articles");
  assert(intel.products.length === products.length, "intel lists all products");
  assert(intel.integrity.valid === integrity.valid, "integrity mirrored");

  console.log("=== Commerce signals ===");
  const signals = buildCommerceSignals(articles, products);
  assert(
    signals.productWithoutArticle ===
      (signals.productWithoutArticleIds.length > 0),
    "productWithoutArticle flag consistency",
  );
  assert(
    signals.articleWithoutProduct ===
      (signals.articleWithoutProductIds.length > 0),
    "articleWithoutProduct flag consistency",
  );
  assert(
    signals.highIntentWithoutCoverage ===
      (signals.highIntentWithoutCoverageIds.length > 0),
    "highIntentWithoutCoverage flag consistency",
  );
  assert(
    signals.productWithoutArticleIds.length === coverage.products.unreferenced,
    "commerce unreferenced ids match coverage",
  );

  console.log("=== Health report ===");
  const health = buildContentHealthReport(articles, products);
  assert(health.articleCount === coverage.articles.total, "health articles");
  assert(health.productCount === coverage.products.total, "health products");
  assert(health.topicCount === coverage.topics.total, "health topics");
  assert(
    health.productsWithoutContent.length === coverage.products.unreferenced,
    "health products without content",
  );

  console.log("=== Fixture: orphan + high-intent gap ===");
  const base: ArticleV1 = {
    identity: { id: "ci-fixture-a", title: "CI Fixture", slug: "ci-fixture-a" },
    classification: { type: "guide", category: "chairs" },
    editorial: { intent: "commercial", summary: "fixture" },
    publishing: { status: "published" },
    products: { primary: [] },
    relationships: { parentTopic: "ci-lonely-topic" },
  };
  const fixtureSignals = buildCommerceSignals([base], fsProducts);
  assert(fixtureSignals.articleWithoutProduct, "fixture articleWithoutProduct");
  assert(fixtureSignals.highIntentWithoutCoverage, "fixture highIntent gap");
  const fixtureCoverage = buildContentCoverageReport([base], fsProducts);
  assert(fixtureCoverage.articles.withoutProducts === 1, "fixture without products");
  assert(fixtureCoverage.topics.total >= 1, "fixture topic aggregated");
  const lonely = fixtureCoverage.topics.rows.find(
    (r) => r.topicId === "ci-lonely-topic",
  );
  assert(lonely?.coverage === "needs-expansion", "lonely topic needs expansion");

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Content intelligence validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
