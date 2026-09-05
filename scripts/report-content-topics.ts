/**
 * Topic cluster coverage report (Phase 31).
 * Usage: npm run report:content-topics
 *
 * Informational only — no mutations.
 */
import "./load-env-local";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { buildTopicCoverageRows } from "../src/lib/content-intelligence";
import { closeDb } from "../src/lib/db/client";

async function main() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const rows = buildTopicCoverageRows(articles, products);

  console.log("Content Topics Report");
  console.log("");
  console.log(`Topics: ${rows.length}`);
  console.log("");

  for (const row of rows) {
    console.log(`Topic:`);
    console.log(`  ${row.topicId}`);
    console.log("");
    console.log(`Articles:`);
    console.log(`  ${row.articleCount}`);
    console.log("");
    console.log(`Products:`);
    console.log(`  ${row.productCount}`);
    console.log("");
    console.log(`Coverage:`);
    console.log(`  ${row.coverage}`);
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
