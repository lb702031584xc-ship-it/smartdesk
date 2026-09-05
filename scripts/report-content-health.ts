/**
 * Content health report (Phase 31).
 * Usage: npm run report:content-health
 *
 * Informational only — no automatic fixes.
 */
import "./load-env-local";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { buildContentHealthReport } from "../src/lib/content-intelligence";
import { closeDb } from "../src/lib/db/client";

async function main() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const health = buildContentHealthReport(articles, products);

  console.log("Content Health");
  console.log("");
  console.log(`Articles:`);
  console.log(`  ${health.articleCount}`);
  console.log("");
  console.log(`Products:`);
  console.log(`  ${health.productCount}`);
  console.log("");
  console.log(`Topics:`);
  console.log(`  ${health.topicCount}`);
  console.log("");
  console.log("Issues:");
  console.log("");
  console.log(`Orphan articles:`);
  console.log(`  ${health.orphanArticles.length}`);
  for (const a of health.orphanArticles) {
    console.log(`  - ${a.articleId}`);
  }
  console.log("");
  console.log(`Products without content:`);
  console.log(`  ${health.productsWithoutContent.length}`);
  for (const p of health.productsWithoutContent) {
    console.log(`  - ${p.productId}`);
  }
  console.log("");
  console.log(`Articles without products:`);
  console.log(`  ${health.articlesWithoutProducts.length}`);
  for (const a of health.articlesWithoutProducts) {
    console.log(`  - ${a.articleId}`);
  }
  console.log("");
  console.log(`Topics needing expansion:`);
  console.log(`  ${health.topicsNeedingExpansion.length}`);
  for (const t of health.topicsNeedingExpansion) {
    console.log(`  - ${t.topicId} (${t.coverage}, articles=${t.articleCount})`);
  }
  console.log("");
  console.log("Commercial signals:");
  console.log(`  productWithoutArticle: ${health.commercial.productWithoutArticle}`);
  console.log(`  articleWithoutProduct: ${health.commercial.articleWithoutProduct}`);
  console.log(
    `  highIntentWithoutCoverage: ${health.commercial.highIntentWithoutCoverage}`,
  );
  console.log("");
  console.log(
    `Integrity: ${health.integrity.valid ? "PASS" : "FAIL"} (errors=${health.integrity.errors.length})`,
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
