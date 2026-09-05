/**
 * Publishing workflow and on-demand revalidation checks.
 */
import {
  collectArticleRevalidationPaths,
  collectProductRevalidationPaths,
  findPublishedArticleSlugsReferencingProduct,
  revalidationWarning,
} from "../src/lib/admin/revalidate-content";
import {
  createAdminArticle,
  getAdminArticle,
  listAdminArticles,
  saveAdminArticle,
} from "../src/lib/admin";
import { deleteAdminArticleRecord } from "../src/lib/admin/article-store";
import { validateAdminArticleSave } from "../src/lib/admin/validate-save";
import { isArticleCreateEnabled } from "../src/lib/admin/article-create-policy";
import { articleMarkdownExists } from "../src/lib/content/article-markdown";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { getArticleSlugs } from "../src/lib/articles";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_ID = "zz-admin-publish-test-article";
const TEST_SLUG = "zz-admin-publish-test-article";
const TEST_BODY = "# Publish test\n\nTemporary Phase 15 validation content.\n";

function fail(message: string): never {
  console.error(`[publishing] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function testArticle(overrides: Partial<ArticleV1> = {}): ArticleV1 {
  return {
    identity: {
      id: TEST_ID,
      title: "Admin Publish Test Article",
      slug: TEST_SLUG,
    },
    classification: {
      type: "guide",
      category: "desks",
    },
    editorial: {
      intent: "informational",
      summary: "Temporary publish validation fixture.",
    },
    publishing: {
      status: "draft",
      featured: false,
    },
    ...overrides,
  };
}

async function cleanup() {
  const existing = await getAdminArticle(TEST_ID);
  if (existing || articleMarkdownExists(TEST_SLUG)) {
    await deleteAdminArticleRecord(TEST_ID, TEST_SLUG).catch(() => undefined);
  }
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required for publishing validation.");
  }
  assert(isArticleCreateEnabled(), "Article create must be enabled in this environment");

  await cleanup();

  const articlesBefore = await listAdminArticles();
  assert(articlesBefore.length === 12, `expected 12 articles before test, got ${articlesBefore.length}`);

  const publishPaths = collectArticleRevalidationPaths({
    slug: "example-slug",
    previousStatus: "draft",
    nextStatus: "published",
    listingFieldsChanged: true,
    category: "desks",
  });
  assert(publishPaths.includes("/blog/example-slug"), "publish should revalidate article route");
  assert(publishPaths.includes("/"), "publish should revalidate homepage");
  assert(publishPaths.includes("/blog"), "publish should revalidate blog index");
  assert(publishPaths.includes("/sitemap.xml"), "publish should revalidate sitemap");

  const bodyEditPaths = collectArticleRevalidationPaths({
    slug: "example-slug",
    previousStatus: "published",
    nextStatus: "published",
  });
  assert(
    bodyEditPaths.length === 1 && bodyEditPaths[0] === "/blog/example-slug",
    "published body-only edit should revalidate article route only",
  );

  const unpublishPaths = collectArticleRevalidationPaths({
    slug: "example-slug",
    previousStatus: "published",
    nextStatus: "draft",
    listingFieldsChanged: true,
    category: "desks",
  });
  assert(unpublishPaths.includes("/blog/example-slug"), "unpublish should invalidate article route");

  const branchRefs = await findPublishedArticleSlugsReferencingProduct("branch-ergonomic-chair");
  assert(branchRefs.length > 0, "branch-ergonomic-chair should be referenced by published articles");
  const productPaths = collectProductRevalidationPaths({
    articleSlugs: branchRefs,
    category: "chairs",
    featuredChanged: true,
  });
  assert(productPaths.some((path) => path.startsWith("/blog/")), "product save should revalidate article routes");
  assert(productPaths.includes("/"), "featured product change should revalidate homepage");

  assert(
    revalidationWarning({ attempted: true, ok: false, paths: ["/blog/x"] }) ===
      "Saved, but public page refresh failed.",
    "revalidation failure warning",
  );
  assert(revalidationWarning({ attempted: false, ok: true, paths: [] }) === undefined, "no warning when skipped");

  const emptyPublish = await validateAdminArticleSave(
    {
      ...testArticle(),
      publishing: { status: "published", featured: false },
    },
    { body: "" },
  );
  assert(!emptyPublish.ok, "published empty body must be blocked");
  assert(
    emptyPublish.errors.some((error) => error.includes("Markdown body")),
    "empty body publish error message",
  );

  const created = await createAdminArticle(testArticle());
  assert(created.ok, "draft create for publish test must succeed");

  let slugs = await getArticleSlugs();
  assert(!slugs.includes(TEST_SLUG), "draft must not appear in public slug list");

  const draftRecord = await getAdminArticle(TEST_ID);
  assert(draftRecord?.body === "", "draft starts with empty body");

  const publishAttempt = await saveAdminArticle(
    {
      ...draftRecord!.article,
      publishing: { ...draftRecord!.article.publishing, status: "published" },
    },
    { expectedVersion: draftRecord!.version, body: "" },
  );
  assert(!publishAttempt.ok, "publish without body must fail");

  const published = await saveAdminArticle(
    {
      ...draftRecord!.article,
      publishing: { ...draftRecord!.article.publishing, status: "published" },
    },
    { expectedVersion: draftRecord!.version, body: TEST_BODY },
  );
  assert(published.ok, "draft → published save must succeed");

  slugs = await getArticleSlugs();
  assert(slugs.includes(TEST_SLUG), "published slug must appear in public slug list");

  const publishedRecord = await getAdminArticle(TEST_ID);
  assert(publishedRecord?.article.publishing.status === "published", "DB status must be published");
  assert(publishedRecord?.body === TEST_BODY, "published body must persist");

  const reviewSave = await saveAdminArticle(
    {
      ...publishedRecord!.article,
      publishing: { ...publishedRecord!.article.publishing, status: "review" },
    },
    { expectedVersion: publishedRecord!.version, body: TEST_BODY },
  );
  assert(reviewSave.ok, "published → review save must succeed");
  slugs = await getArticleSlugs();
  assert(!slugs.includes(TEST_SLUG), "review must not appear in public slug list");

  const archived = await saveAdminArticle(
    {
      ...publishedRecord!.article,
      publishing: { ...publishedRecord!.article.publishing, status: "archived" },
    },
    { expectedVersion: reviewSave.version, body: TEST_BODY },
  );
  assert(archived.ok, "review → archived save must succeed");
  slugs = await getArticleSlugs();
  assert(!slugs.includes(TEST_SLUG), "archived must not appear in public slug list");

  await cleanup();
  slugs = await getArticleSlugs();
  assert(!slugs.includes(TEST_SLUG), "cleanup must remove test slug from public list");
  assert((await listAdminArticles()).length === 12, "article count restored to 12");

  await closeDb();
  console.log("[publishing] Path planning: PASS");
  console.log("[publishing] Product dependency discovery: PASS");
  console.log("[publishing] Empty body publish block: PASS");
  console.log("[publishing] Draft non-public: PASS");
  console.log("[publishing] Draft → Published: PASS");
  console.log("[publishing] Published → Review: PASS");
  console.log("[publishing] Review → Archived: PASS");
  console.log("[publishing] Cleanup: PASS");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
