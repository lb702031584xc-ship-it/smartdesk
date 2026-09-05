/**
 * Idempotent import of canonical V1 JSON + markdown into Postgres.
 *
 * Run: npm run db:seed-content
 * Requires: DATABASE_URL, CONTENT_STORE=database (optional for seed — uses DB directly)
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { isArticleV1, validateArticleV1 } from "../src/lib/article-schema";
import { validateProductV1 } from "../src/lib/product-schema";
import { upsertDatabaseArticleV1 } from "../src/lib/content/database-articles";
import { upsertDatabaseProductV1 } from "../src/lib/content/database-products";
import { closeDb, isDatabaseConfigured } from "../src/lib/db/client";

function fail(message: string): never {
  console.error(`[db:seed-content] ${message}`);
  process.exit(1);
}

const productsDir = path.join(process.cwd(), "content/products");
const articleDataDir = path.join(process.cwd(), "content/article-data");
const postsDir = path.join(process.cwd(), "content/posts");

async function main() {
  if (!isDatabaseConfigured()) {
    fail("DATABASE_URL is required for content seed.");
  }

  const productFiles = fs
    .readdirSync(productsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let productCount = 0;
  for (const fileName of productFiles) {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(productsDir, fileName), "utf8"),
    ) as unknown;
    const validation = validateProductV1(parsed);
    if (!validation.valid) {
      fail(`${fileName}: ${validation.errors.join("; ")}`);
    }
    const result = await upsertDatabaseProductV1(parsed as import("../src/types/product-v1").ProductV1Document);
    if (!result.ok) fail(`Failed to upsert product ${fileName}`);
    productCount += 1;
    console.log(`[db:seed-content] product ${(parsed as { id: string }).id}`);
  }

  const articleFiles = fs
    .readdirSync(articleDataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let articleCount = 0;
  for (const fileName of articleFiles) {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(articleDataDir, fileName), "utf8"),
    ) as unknown;
    const structural = validateArticleV1(parsed);
    if (!structural.valid || !isArticleV1(parsed)) {
      fail(`${fileName}: ${structural.errors.join("; ")}`);
    }
    const article = parsed as import("../src/types/article-v1").ArticleV1;
    const mdPath = path.join(postsDir, `${article.identity.slug}.md`);
    let body = "";
    if (fs.existsSync(mdPath)) {
      body = matter(fs.readFileSync(mdPath, "utf8")).content;
    }
    const result = await upsertDatabaseArticleV1(article, body);
    if (!result.ok) fail(`Failed to upsert article ${fileName}`);
    articleCount += 1;
    console.log(`[db:seed-content] article ${article.identity.id}`);
  }

  await closeDb();

  console.log(`[db:seed-content] imported ${productCount} products, ${articleCount} articles`);
  if (productCount !== 13 || articleCount !== 12) {
    fail(`Expected 13 products and 12 articles, got ${productCount}/${articleCount}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
