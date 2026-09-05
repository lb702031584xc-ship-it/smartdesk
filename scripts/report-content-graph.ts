/**
 * Content Graph corpus report (Phase 30) — informational only.
 * Usage: npm run report:content-graph
 *
 * Does not mutate content. Does not inject links.
 */
import "./load-env-local";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import {
  buildContentGraphReport,
  buildTopicClusters,
  getTopicArticles,
  getTopicProducts,
} from "../src/lib/content-graph";
import { closeDb } from "../src/lib/db/client";

async function main() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const report = buildContentGraphReport(articles, products);
  const topics = buildTopicClusters(articles);

  console.log("Content Graph Report");
  console.log("");
  console.log(`Articles: ${report.articleCount}`);
  console.log(`Products: ${report.productCount}`);
  console.log(`Topics: ${report.topicCount}`);
  console.log("");

  console.log("Topics:");
  for (const topic of [...topics.values()].sort((a, b) =>
    a.topicId.localeCompare(b.topicId),
  )) {
    const topicArticles = getTopicArticles(topic.topicId, articles);
    const topicProducts = getTopicProducts(topic.topicId, articles, products);
    console.log(
      `  - ${topic.topicId}: ${topicArticles.length} articles, ${topicProducts.length} products`,
    );
  }

  console.log("");
  console.log(`Orphan Articles: ${report.orphanArticles.length}`);
  for (const a of report.orphanArticles) {
    console.log(`  - ${a.articleId} (${a.slug})`);
  }

  console.log("");
  console.log(`Articles without products: ${report.articlesWithoutProducts.length}`);
  for (const a of report.articlesWithoutProducts) {
    console.log(`  - ${a.articleId} (${a.slug})`);
  }

  console.log("");
  console.log(`Products without articles: ${report.productsWithoutArticles.length}`);
  for (const p of report.productsWithoutArticles) {
    console.log(`  - ${p.productId}`);
  }

  console.log("");
  console.log(`Sparse topics (<2 articles): ${report.sparseTopics.length}`);
  for (const t of report.sparseTopics) {
    console.log(`  - ${t.topicId} (${t.articleIds.length})`);
  }

  console.log("");
  console.log(
    `Integrity: ${report.integrity.valid ? "PASS" : "FAIL"} (errors=${report.integrity.errors.length}, warnings=${report.integrity.warnings.length})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
