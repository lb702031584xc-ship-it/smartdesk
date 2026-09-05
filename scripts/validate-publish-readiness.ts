/**
 * Evaluate publish readiness for all articles.
 * Usage: npx tsx scripts/validate-publish-readiness.ts
 */
import { listArticlesV1, getArticleV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { evaluateArticleReadiness } from "../src/lib/editorial/article-readiness";

async function main() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  let failures = 0;

  for (const article of articles) {
    const record = await getArticleV1(article.identity.id);
    const body = record?.body ?? "";
    const result = evaluateArticleReadiness(article, body, products);
    const status = article.publishing.status;
    const blockerCount = result.blockers.length;
    const warningCount = result.warnings.length;

    if (blockerCount > 0 && (status === "published" || status === "scheduled")) {
      failures++;
      console.error(
        `FAIL ${article.identity.id} (${status}): ${blockerCount} blockers`,
      );
      for (const b of result.blockers) {
        console.error(`  [BLOCKER] ${b.id}: ${b.message}`);
      }
    } else if (blockerCount > 0) {
      console.log(
        `WARN ${article.identity.id} (${status}): ${blockerCount} blockers, ${warningCount} warnings`,
      );
    } else {
      console.log(
        `OK   ${article.identity.id} (${status}): ready, ${warningCount} warnings`,
      );
    }

    if (warningCount > 0) {
      for (const w of result.warnings) {
        console.log(`  [WARNING] ${w.id}: ${w.message}`);
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} published/scheduled article(s) have blockers!`);
    process.exit(1);
  }

  console.log("\nAll published/scheduled articles pass readiness checks.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
