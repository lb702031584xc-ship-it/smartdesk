/**
 * Article creation INSERT checks with Markdown body + cleanup.
 */
import fs from "fs";
import path from "path";
import { createAdminArticleAction } from "../src/lib/admin/actions";
import {
  createAdminArticle,
  listAdminArticles,
  listAdminProducts,
  getAdminArticle,
} from "../src/lib/admin";
import { deleteAdminArticleRecord } from "../src/lib/admin/article-store";
import { validateAdminArticleCreate } from "../src/lib/admin/validate-save";
import {
  validateArticleIdFormat,
  validateArticleSlugFormat,
} from "../src/lib/admin/article-id";
import { isArticleCreateEnabled } from "../src/lib/admin/article-create-policy";
import { articleMarkdownExists } from "../src/lib/content/article-markdown";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { getArticleSlugs } from "../src/lib/articles";
import { closeDb } from "../src/lib/db/client";
import { validateArticleV1 } from "../src/lib/article-schema";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_ID = "zz-admin-create-test-article";
const TEST_SLUG = "zz-admin-create-test-article";

function fail(message: string): never {
  console.error(`[admin-article-create] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function testArticle(overrides: Partial<ArticleV1> = {}): ArticleV1 {
  return {
    identity: {
      id: TEST_ID,
      title: "Admin Create Test Article",
      slug: TEST_SLUG,
    },
    classification: {
      type: "guide",
    },
    editorial: {
      intent: "informational",
    },
    publishing: {
      status: "draft",
      featured: false,
    },
    ...overrides,
  };
}

async function cleanupTestArticle() {
  const existing = await getAdminArticle(TEST_ID);
  if (existing || articleMarkdownExists(TEST_SLUG)) {
    await deleteAdminArticleRecord(TEST_ID, TEST_SLUG).catch(async () => {
      const mdPath = path.join(process.cwd(), "content/posts", `${TEST_SLUG}.md`);
      if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
    });
  }
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required for Article create validation.");
  }
  assert(isArticleCreateEnabled(), "Article create must be enabled in this environment");

  await cleanupTestArticle();

  const articlesBefore = await listAdminArticles();
  const productsBefore = await listAdminProducts();
  assert(articlesBefore.length === 12, `expected 12 articles before create, got ${articlesBefore.length}`);
  assert(productsBefore.length === 13, `expected 13 products, got ${productsBefore.length}`);

  assert(validateArticleIdFormat("") === "Article ID is required.", "empty ID should fail");
  assert(Boolean(validateArticleSlugFormat("Bad Slug")), "spaces in slug should fail");
  assert(Boolean(validateArticleIdFormat("new")), "reserved new id should fail");
  assert(validateArticleIdFormat(TEST_ID) === undefined, "fixture id should be valid");
  assert(validateArticleSlugFormat(TEST_SLUG) === undefined, "fixture slug should be valid");

  const duplicateId = await createAdminArticle({
    ...testArticle(),
    identity: {
      id: "flexispot-compact-standing-desk-review",
      title: "Should Not Overwrite",
      slug: TEST_SLUG,
    },
  });
  assert(!duplicateId.ok, "duplicate Article ID must be rejected");
  assert(
    duplicateId.errors.some((error) => error.toLowerCase().includes("id already exists")),
    "duplicate ID error should be friendly",
  );
  const original = await getAdminArticle("flexispot-compact-standing-desk-review");
  assert(
    Boolean(original?.article.identity.title.includes("FlexiSpot")),
    "duplicate create must not overwrite existing Article",
  );

  const duplicateSlug = await createAdminArticle({
    ...testArticle(),
    identity: {
      id: TEST_ID,
      title: "Should Not Overwrite Slug",
      slug: "flexispot-compact-standing-desk-review",
    },
  });
  assert(!duplicateSlug.ok, "duplicate Article slug must be rejected");
  assert(
    duplicateSlug.errors.some((error) => error.toLowerCase().includes("slug already exists")),
    "duplicate slug error should be friendly",
  );

  const invalid = await validateAdminArticleCreate({
    identity: { id: TEST_ID, title: "", slug: TEST_SLUG },
    classification: { type: "comparison" },
    editorial: { intent: "commercial" },
    publishing: { status: "draft" },
    products: { primary: [{ productId: "flexispot-compact" }] },
  });
  assert(!invalid.ok, "invalid comparison (<2 products) must fail");

  const invalidInsert = await createAdminArticle({
    identity: { id: TEST_ID, title: "", slug: TEST_SLUG },
    classification: { type: "guide" },
    editorial: { intent: "informational" },
    publishing: { status: "draft" },
  });
  assert(!invalidInsert.ok, "invalid Article must not insert");
  assert(!(await getAdminArticle(TEST_ID)), "invalid Article must stay absent");
  assert(!articleMarkdownExists(TEST_SLUG), "invalid create must not leave Markdown");

  const publishedBlocked = await createAdminArticle({
    ...testArticle(),
    publishing: { status: "published", featured: false },
  });
  assert(!publishedBlocked.ok, "create must reject non-draft status");

  const unauthenticated = await createAdminArticleAction(testArticle());
  assert(!unauthenticated.ok, "create action without admin session must fail");
  assert(
    unauthenticated.errors.some((error) => error.toLowerCase().includes("session")),
    "unauthenticated create should report session expiry",
  );
  assert(!(await getAdminArticle(TEST_ID)), "unauthenticated create must not insert");
  assert(!articleMarkdownExists(TEST_SLUG), "unauthenticated create must not write Markdown");

  // Existing body-path: create a temporary md then reject create
  const mdPath = path.join(process.cwd(), "content/posts", `${TEST_SLUG}.md`);
  fs.writeFileSync(
    mdPath,
    `---\nschemaVersion: 1\narticleData: ${TEST_SLUG}.json\n---\n\n`,
    "utf8",
  );
  const bodyExists = await createAdminArticle(testArticle());
  assert(!bodyExists.ok, "existing Markdown path must be rejected");
  assert(
    bodyExists.errors.some((error) => error.toLowerCase().includes("markdown")),
    "existing Markdown error should be friendly",
  );
  assert(!(await getAdminArticle(TEST_ID)), "existing Markdown reject must not insert DB");
  fs.unlinkSync(mdPath);

  const created = await createAdminArticle(testArticle());
  assert(created.ok, `valid Article insert failed: ${created.errors.join("; ")}`);

  const loaded = await getAdminArticle(TEST_ID);
  assert(Boolean(loaded), "created Article must be retrievable");
  assert(loaded?.article.publishing.status === "draft", "created Article must be draft");
  assert(loaded?.article.identity.slug === TEST_SLUG, "slug mismatch");
  assert(loaded?.body === "", "initial body should be empty string in DB");
  const structural = validateArticleV1(loaded!.article);
  assert(structural.valid, `created Article failed ArticleV1 validation: ${structural.errors.join("; ")}`);
  assert(articleMarkdownExists(TEST_SLUG), "Markdown body file must exist");
  assert(fs.existsSync(mdPath), "Markdown path must exist on disk");
  assert(
    !fs.existsSync(path.join(process.cwd(), "content/article-data", `${TEST_SLUG}.json`)),
    "create must not write repository Article JSON metadata",
  );

  const listed = await listAdminArticles();
  assert(listed.some((item) => item.id === TEST_ID), "created Article must appear in Admin list");
  assert(listed.length === articlesBefore.length + 1, "Admin list count should increase by 1");
  assert(listed.some((item) => item.id === TEST_ID && item.status === "draft"), "list status draft");

  const publicSlugs = await getArticleSlugs();
  assert(!publicSlugs.includes(TEST_SLUG), "draft Article must not be publicly routable");

  const productsDuring = await listAdminProducts();
  assert(productsDuring.length === 13, "creating an Article must not change Product count");

  await deleteAdminArticleRecord(TEST_ID, TEST_SLUG);
  assert(!(await getAdminArticle(TEST_ID)), "cleanup must remove the test Article");
  assert(!articleMarkdownExists(TEST_SLUG), "cleanup must remove Markdown");

  const articlesAfter = await listAdminArticles();
  const productsAfter = await listAdminProducts();
  assert(articlesAfter.length === articlesBefore.length, "article count must be restored");
  assert(productsAfter.length === 13, "product count must stay 13");
  assert(!articlesAfter.some((item) => item.id === TEST_ID), "fixture must not remain");

  console.log("[admin-article-create] Duplicate ID: PASS");
  console.log("[admin-article-create] Duplicate slug: PASS");
  console.log("[admin-article-create] Existing Markdown path: PASS");
  console.log("[admin-article-create] Invalid Article: PASS");
  console.log("[admin-article-create] Auth-gated action: PASS");
  console.log("[admin-article-create] Valid Article insert: PASS");
  console.log("[admin-article-create] Draft routing: PASS");
  console.log("[admin-article-create] Cleanup: PASS");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await cleanupTestArticle().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
