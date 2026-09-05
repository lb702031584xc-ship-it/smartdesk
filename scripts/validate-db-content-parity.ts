/**
 * Compare filesystem canonical V1 vs database canonical V1.
 *
 * Run: npm run validate:db-content-parity
 * Requires: DATABASE_URL
 */
import { canonicalEquals } from "../src/lib/content/canonical-json";
import {
  listFilesystemArticleIds,
  listFilesystemArticlesV1,
} from "../src/lib/content/filesystem-articles";
import {
  listFilesystemProductIds,
  listFilesystemProductsV1,
} from "../src/lib/content/filesystem-products";
import {
  listDatabaseArticleIds,
  listDatabaseArticlesV1,
} from "../src/lib/content/database-articles";
import {
  listDatabaseProductIds,
  listDatabaseProductsV1,
} from "../src/lib/content/database-products";
import { closeDb, isDatabaseConfigured } from "../src/lib/db/client";
import { getFilesystemArticleV1 } from "../src/lib/content/filesystem-articles";
import { getDatabaseArticleV1 } from "../src/lib/content/database-articles";

function fail(message: string): never {
  console.error(`[db-content-parity] ${message}`);
  process.exit(1);
}

async function main() {
  if (!isDatabaseConfigured()) {
    console.log("[db-content-parity] SKIP — DATABASE_URL not configured");
    process.exit(0);
  }

  const fsProductIds = listFilesystemProductIds();
  const dbProductIds = await listDatabaseProductIds();

  if (fsProductIds.length !== 13) {
    fail(`Expected 13 filesystem products, found ${fsProductIds.length}`);
  }
  if (dbProductIds.length !== 13) {
    fail(`Expected 13 database products, found ${dbProductIds.length}`);
  }

  const fsProducts = listFilesystemProductsV1();
  const dbProducts = await listDatabaseProductsV1();

  for (const fsProduct of fsProducts) {
    const dbMatch = dbProducts.find((p) => p.id === fsProduct.id);
    if (!dbMatch) fail(`Missing database product: ${fsProduct.id}`);
    if (!canonicalEquals(fsProduct, dbMatch)) {
      fail(`Product parity mismatch: ${fsProduct.id}`);
    }
  }

  const fsArticleIds = listFilesystemArticleIds();
  const dbArticleIds = await listDatabaseArticleIds();

  if (fsArticleIds.length !== 12) {
    fail(`Expected 12 filesystem articles, found ${fsArticleIds.length}`);
  }
  if (dbArticleIds.length !== 12) {
    fail(`Expected 12 database articles, found ${dbArticleIds.length}`);
  }

  const fsArticles = listFilesystemArticlesV1();
  const dbArticles = await listDatabaseArticlesV1();

  for (const fsArticle of fsArticles) {
    const dbMatch = dbArticles.find((a) => a.identity.id === fsArticle.identity.id);
    if (!dbMatch) fail(`Missing database article: ${fsArticle.identity.id}`);
    if (!canonicalEquals(fsArticle, dbMatch)) {
      fail(`Article V1 parity mismatch: ${fsArticle.identity.id}`);
    }

    const fsRecord = getFilesystemArticleV1(fsArticle.identity.id);
    const dbRecord = await getDatabaseArticleV1(fsArticle.identity.id);
    if (!fsRecord || !dbRecord) fail(`Missing article record for body check`);
    if (fsRecord.body.trim() !== dbRecord.body.trim()) {
      fail(`Article body parity mismatch: ${fsArticle.identity.id}`);
    }
  }

  await closeDb();
  console.log("[db-content-parity] Products: 13/13 PASS");
  console.log("[db-content-parity] Articles: 12/12 PASS");
  console.log("[db-content-parity] filesystem ↔ database parity OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
