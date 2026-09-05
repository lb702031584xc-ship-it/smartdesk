/**
 * Admin data layer smoke checks.
 */
import { closeDb } from "../src/lib/db/client";
import {
  getAdminArticle,
  getAdminProduct,
  getAdminWriteMode,
  isAdminWriteEnabled,
  listAdminArticles,
  listAdminProducts,
  saveAdminArticle,
  saveAdminProduct,
  validateAdminArticleSave,
  validateAdminProductSave,
} from "../src/lib/admin";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";

function fail(message: string): never {
  console.error(`[admin-data] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

async function main() {
  const products = await listAdminProducts();
  const articles = await listAdminArticles();

  assert(products.length === 13, `Expected 13 products, found ${products.length}`);
  assert(articles.length === 12, `Expected 12 articles, found ${articles.length}`);

  const sampleProduct = await getAdminProduct("flexispot-compact");
  assert(Boolean(sampleProduct?.product.schemaVersion === 1), "flexispot-compact must be ProductV1");
  assert(
    Boolean(sampleProduct?.product.identity.name.includes("FlexiSpot")),
    "flexispot-compact name mismatch",
  );

  const sampleArticle = await getAdminArticle("flexispot-compact-standing-desk-review");
  assert(Boolean(sampleArticle?.article.identity.title), "sample article must load as ArticleV1");
  assert(
    Boolean(sampleArticle?.article.classification.type === "review"),
    "sample article must be review type",
  );

  const invalidProduct = {
    schemaVersion: 1,
    id: "invalid-test-product",
    identity: { name: "", brand: "X", category: "desks" },
  } as ProductV1Document;

  const invalidProductResult = validateAdminProductSave(invalidProduct);
  assert(!invalidProductResult.ok, "invalid product must fail validation");

  const invalidArticle = {
    identity: { id: "bad", title: "", slug: "bad" },
    classification: { type: "review" },
    editorial: { intent: "commercial" },
    publishing: { status: "draft" },
  } as ArticleV1;

  const invalidArticleResult = await validateAdminArticleSave(invalidArticle);
  assert(!invalidArticleResult.ok, "invalid article must fail validation");

  const writeMode = getAdminWriteMode();
  console.log(`[admin-data] write mode: ${writeMode}`);

  if (isAdminWriteEnabled() && sampleProduct) {
    const saveOk = await saveAdminProduct(sampleProduct.product, {
      expectedVersion: sampleProduct.version,
    });
    assert(saveOk.ok, `valid product re-save should succeed: ${saveOk.errors.join("; ")}`);
  } else {
    const blocked = await saveAdminProduct({
      schemaVersion: 1,
      id: "should-not-write",
      identity: { name: "X", brand: "Y", category: "desks" },
    });
    assert(
      blocked.blocked === true || !blocked.ok,
      "save must be blocked or fail when writes disabled",
    );
    console.log("[admin-data] save boundary blocked/disabled (expected without DB or dev FS)");
  }

  if (isAdminWriteEnabled() && sampleArticle) {
    const saveArticleOk = await saveAdminArticle(sampleArticle.article, {
      expectedVersion: sampleArticle.version,
      body: sampleArticle.body,
    });
    assert(saveArticleOk.ok, `valid article re-save should succeed: ${saveArticleOk.errors.join("; ")}`);
  }

  console.log("[admin-data] list products: 13");
  console.log("[admin-data] list articles: 12");
  console.log("[admin-data] canonical V1 read/save boundary OK");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
