/**
 * Phase 27 — Article Schema V1 + Product relationship layer validation.
 *
 * Run: npm run validate:article-schema
 *
 * Covers:
 * - ArticleV1 structural contract (identity, type enum, publishing status, SEO)
 * - Product refs are IDs only (no catalog/commerce duplication)
 * - Article → ProductV1 resolver (ArticleWithProducts)
 * - Fixtures: best-list, review, comparison
 * - Existing production adapter path still adapts without mutation
 */
import fs from "fs";
import path from "path";
import {
  articleV1ToLegacyMeta,
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
} from "../src/lib/article-schema";
import { resolveArticleWithProducts } from "../src/lib/article-products";
import { listFilesystemProductsV1 } from "../src/lib/content/filesystem-products";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function productMap(): Map<string, ProductV1Document> {
  return new Map(listFilesystemProductsV1().map((p) => [p.id, p]));
}

const examplesDir = path.join(process.cwd(), "content/examples");
const fixtures = {
  bestList: path.join(examplesDir, "article-schema-v1-example.json"),
  review: path.join(examplesDir, "article-schema-v1-review-fixture.json"),
  comparison: path.join(examplesDir, "article-schema-v1-comparison-fixture.json"),
};

console.log("=== Article Schema V1 fixtures ===");

const products = productMap();
const lookup = (id: string) => products.has(id);

for (const [label, filePath] of Object.entries(fixtures)) {
  assert(fs.existsSync(filePath), `${label} fixture exists`);
  const parsed = readJson(filePath);
  const structural = validateArticleV1(parsed);
  assert(structural.valid, `${label}: structural valid (${structural.errors.join("; ")})`);
  const article = parsed as ArticleV1;
  const template = validateArticleV1TemplateRules(article);
  assert(template.valid, `${label}: template valid (${template.errors.join("; ")})`);
  const refs = validateArticleV1ProductRefs(article, lookup, {
    missingProductSeverity: "error",
  });
  assert(refs.valid, `${label}: product refs resolve (${refs.errors.join("; ")})`);

  const resolved = resolveArticleWithProducts(article, (id) => products.get(id), {
    body: "# Fixture body\n",
  });
  assert(
    resolved.missingProductIds.length === 0,
    `${label}: resolver missingProductIds empty`,
  );
  assert(
    resolved.products.length === (article.products?.primary?.length ?? 0),
    `${label}: resolver product count matches refs`,
  );
  assert(resolved.body === "# Fixture body\n", `${label}: body paired without HTML`);
  assert(
    resolved.products.every((p) => p.identity?.name && p.id),
    `${label}: resolved items are ProductV1 documents`,
  );

  // Adapter still works for public/legacy path — no mutation of ArticleV1.
  const meta = articleV1ToLegacyMeta(article);
  assert(meta.slug === article.identity.slug, `${label}: adapter preserves slug`);
  assert(
    JSON.stringify(article.products) === JSON.stringify((parsed as ArticleV1).products),
    `${label}: adapter does not mutate ArticleV1 products`,
  );
}

console.log("=== Required fields / enums ===");
const empty = validateArticleV1({});
assert(!empty.valid, "empty article fails");
assert(
  empty.errors.some((e) => e.includes("identity")),
  "identity required",
);

const badType = validateArticleV1({
  identity: { id: "x", title: "T", slug: "x" },
  classification: { type: "ranking" },
  editorial: { intent: "commercial" },
  publishing: { status: "published" },
});
assert(!badType.valid, "arbitrary classification.type rejected");

const badStatus = validateArticleV1({
  identity: { id: "x", title: "T", slug: "x" },
  classification: { type: "guide" },
  editorial: { intent: "informational" },
  publishing: { status: "live" },
});
assert(!badStatus.valid, "arbitrary publishing.status rejected");

console.log("=== No product catalog duplication on refs ===");
const duplicated = validateArticleV1({
  identity: { id: "dup", title: "Dup", slug: "dup" },
  classification: { type: "review" },
  editorial: { intent: "commercial" },
  publishing: { status: "draft" },
  products: {
    primary: [
      {
        productId: "budget-ergonomic-chair",
        rank: 1,
        amazonUrl: "https://amazon.com/dp/B07BDFW1Y7",
        price: "$99",
        brand: "Fake",
      },
    ],
  },
});
assert(!duplicated.valid, "amazonUrl/price/brand on product ref rejected");
assert(
  duplicated.errors.some((e) => e.includes("amazonUrl")),
  "amazonUrl duplication error",
);
assert(
  duplicated.errors.some((e) => e.includes("price")),
  "price duplication error",
);
assert(
  duplicated.errors.some((e) => e.includes("brand")),
  "brand duplication error",
);

console.log("=== Resolver missing product ===");
const orphanArticle = readJson(fixtures.bestList) as ArticleV1;
const orphanResolved = resolveArticleWithProducts(orphanArticle, () => undefined);
assert(orphanResolved.products.length === 0, "missing products yield empty products[]");
assert(
  orphanResolved.missingProductIds.includes("branch-ergonomic-chair"),
  "missingProductIds lists unresolved refs",
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("Article schema validation passed.");
