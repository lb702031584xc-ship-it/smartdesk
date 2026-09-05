/**
 * Phase 16B — Revision history validation
 */
import { countArticleRevisions, countProductRevisions } from "../src/lib/db/revisions";
import {
  createAdminArticle,
  createAdminProduct,
  getAdminArticle,
  getAdminProduct,
  listAdminArticles,
  listAdminProducts,
  saveAdminArticle,
  saveAdminProduct,
} from "../src/lib/admin";
import { deleteAdminArticleRecord } from "../src/lib/admin/article-store";
import { deleteAdminProductRecord } from "../src/lib/admin/product-store";
import { publishDueArticles } from "../src/lib/admin/publish-scheduled";
import { SCHEDULED_PUBLISHER_ACTOR } from "../src/lib/admin/revision-constants";
import {
  getArticleRevisionDetail,
  listArticleRevisionItems,
  listProductRevisionItems,
  restoreProductRevision,
} from "../src/lib/admin/revision-store";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { isArticleCreateEnabled } from "../src/lib/admin/article-create-policy";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_PRODUCT_ID = "zz-admin-revision-test-product";
const TEST_ARTICLE_ID = "zz-admin-revision-test-article";
const TEST_ARTICLE_SLUG = "zz-admin-revision-test-article";
const TEST_BODY_A = "# Revision test A\n\nBody version A.\n";
const TEST_BODY_B = "# Revision test B\n\nBody version B with more words here.\n";
const ACTOR = "revision-test@smartdesksetup.com";

function fail(message: string): never {
  console.error(`[revision-history] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function testArticle(overrides: Partial<ArticleV1> = {}): ArticleV1 {
  return {
    identity: {
      id: TEST_ARTICLE_ID,
      title: "Revision Test Article",
      slug: TEST_ARTICLE_SLUG,
    },
    classification: { type: "guide", category: "desks" },
    editorial: { intent: "informational", summary: "Revision validation fixture." },
    publishing: { status: "draft" },
    ...overrides,
  } as ArticleV1;
}

async function cleanup() {
  await deleteAdminArticleRecord(TEST_ARTICLE_ID, TEST_ARTICLE_SLUG).catch(() => undefined);
  await deleteAdminProductRecord(TEST_PRODUCT_ID).catch(() => undefined);
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required.");
  }
  assert(isArticleCreateEnabled(), "Article create must be enabled");

  await cleanup();

  const articlesBefore = (await listAdminArticles()).length;
  const productsBefore = (await listAdminProducts()).length;
  assert(articlesBefore === 12, `expected 12 articles, got ${articlesBefore}`);
  assert(productsBefore === 13, `expected 13 products, got ${productsBefore}`);

  const product = {
    ...blankProductV1(),
    id: TEST_PRODUCT_ID,
    identity: {
      name: "Revision Test Product",
      brand: "Test",
      category: "desks" as const,
    },
  };

  const createdProduct = await createAdminProduct(product);
  assert(createdProduct.ok, "product create must succeed");
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 0, "create must not add revision");

  const productV1 = (await getAdminProduct(TEST_PRODUCT_ID))!;
  const saveB = await saveAdminProduct(
    {
      ...productV1.product,
      identity: { ...productV1.product.identity, name: "Revision Test Product B" },
    },
    { expectedVersion: productV1.version, actor: ACTOR },
  );
  assert(saveB.ok, "product save B must succeed");
  assert(Boolean(saveB.revisionCreated), "product save B must create revision");
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 1, "one product revision after first edit");

  const productV2 = (await getAdminProduct(TEST_PRODUCT_ID))!;
  const saveC = await saveAdminProduct(
    {
      ...productV2.product,
      identity: { ...productV2.product.identity, name: "Revision Test Product C" },
    },
    { expectedVersion: productV2.version, actor: ACTOR },
  );
  assert(saveC.ok, "product save C must succeed");
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 2, "two product revisions after second edit");

  const productRevisions = await listProductRevisionItems(TEST_PRODUCT_ID);
  assert(productRevisions.length === 2, "product revision list length");
  const oldestProductRevision = productRevisions[productRevisions.length - 1]!;

  const productV3 = (await getAdminProduct(TEST_PRODUCT_ID))!;
  const noop = await saveAdminProduct(productV3.product, {
    expectedVersion: productV3.version,
    actor: ACTOR,
  });
  assert(noop.ok, "no-op product save must succeed");
  assert(!noop.revisionCreated, "no-op product save must not create revision");
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 2, "revision count unchanged after no-op");

  const stale = await saveAdminProduct(
    {
      ...productV3.product,
      identity: { ...productV3.product.identity, name: "Stale attempt" },
    },
    { expectedVersion: (productV3.version ?? 1) - 1, actor: ACTOR },
  );
  assert(!stale.ok, "stale product save must fail");
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 2, "revision count unchanged after stale save");

  const restoredProduct = await restoreProductRevision(
    TEST_PRODUCT_ID,
    oldestProductRevision.id,
    { expectedVersion: productV3.version!, actor: ACTOR },
  );
  assert(restoredProduct.ok, "product restore must succeed");
  const productAfterRestore = (await getAdminProduct(TEST_PRODUCT_ID))!;
  assert(
    productAfterRestore.product.identity.name === "Revision Test Product",
    "restored product name must match revision A",
  );
  assert((await countProductRevisions(TEST_PRODUCT_ID)) === 3, "restore must preserve previous current as revision");

  const createdArticle = await createAdminArticle(testArticle());
  assert(createdArticle.ok, "article create must succeed");
  assert((await countArticleRevisions(TEST_ARTICLE_ID)) === 0, "article create must not add revision");

  const articleDraft = (await getAdminArticle(TEST_ARTICLE_ID))!;
  const articleSave1 = await saveAdminArticle(
    {
      ...articleDraft.article,
      editorial: { ...articleDraft.article.editorial, summary: "Updated summary" },
    },
    { expectedVersion: articleDraft.version, body: TEST_BODY_A, actor: ACTOR },
  );
  assert(articleSave1.ok, "article metadata+body save must succeed");
  assert(Boolean(articleSave1.revisionCreated), "article save must create revision");
  assert((await countArticleRevisions(TEST_ARTICLE_ID)) === 1, "one article revision");

  const articleRevision = (await listArticleRevisionItems(TEST_ARTICLE_ID))[0]!;
  const detail = await getArticleRevisionDetail(TEST_ARTICLE_ID, articleRevision.id);
  assert(detail?.body === "", "revision must capture old empty body");
  assert(detail?.data.editorial.summary === "Revision validation fixture.", "revision must capture old metadata");

  const articleV2 = (await getAdminArticle(TEST_ARTICLE_ID))!;
  const articleSave2 = await saveAdminArticle(articleV2.article, {
    expectedVersion: articleV2.version,
    body: TEST_BODY_B,
    actor: ACTOR,
  });
  assert(articleSave2.ok, "article body-only save must succeed");
  assert((await countArticleRevisions(TEST_ARTICLE_ID)) === 2, "two article revisions after body edit");

  const scheduleAt = new Date(Date.now() + 3_600_000);
  const workerNow = new Date(Date.now() + 7_200_000);
  const publishReady = (await getAdminArticle(TEST_ARTICLE_ID))!;

  const scheduleForWorker = await saveAdminArticle(
    {
      ...publishReady.article,
      publishing: {
        ...publishReady.article.publishing,
        status: "scheduled",
        scheduledAt: scheduleAt.toISOString(),
      },
    },
    { expectedVersion: publishReady.version, body: TEST_BODY_B, actor: ACTOR },
  );
  assert(scheduleForWorker.ok, "future scheduled save must succeed");

  const revBeforeWorkerRun = await countArticleRevisions(TEST_ARTICLE_ID);

  const workerResult = await publishDueArticles({
    now: workerNow,
    revalidate: async (paths) => ({ attempted: paths.length > 0, ok: true, paths }),
  });
  assert(workerResult.published >= 1, "scheduled worker must publish due article");

  const publishedRecord = (await getAdminArticle(TEST_ARTICLE_ID))!;
  assert(publishedRecord.article.publishing.status === "published", "worker must publish article");
  assert(
    (await countArticleRevisions(TEST_ARTICLE_ID)) === revBeforeWorkerRun + 1,
    "worker must create one revision",
  );

  const workerRevisions = await listArticleRevisionItems(TEST_ARTICLE_ID);
  const schedulerRevision = workerRevisions.find((item) => item.createdBy === SCHEDULED_PUBLISHER_ACTOR);
  assert(Boolean(schedulerRevision), "scheduler revision must use system actor");

  const revAfterWorker = await countArticleRevisions(TEST_ARTICLE_ID);
  await Promise.all([
    publishDueArticles({
      now: workerNow,
      revalidate: async (paths) => ({ attempted: paths.length > 0, ok: true, paths }),
    }),
    publishDueArticles({
      now: workerNow,
      revalidate: async (paths) => ({ attempted: paths.length > 0, ok: true, paths }),
    }),
  ]);
  assert(
    (await countArticleRevisions(TEST_ARTICLE_ID)) === revAfterWorker,
    "overlapping worker must not create duplicate scheduler revision",
  );

  await cleanup();
  assert((await listAdminArticles()).length === 12, "article count restored");
  assert((await listAdminProducts()).length === 13, "product count restored");

  await closeDb();
  console.log("[revision-history] Product revision test: PASS");
  console.log("[revision-history] Article revision test: PASS");
  console.log("[revision-history] Body revision test: PASS");
  console.log("[revision-history] No-op save: PASS");
  console.log("[revision-history] Stale save: PASS");
  console.log("[revision-history] Restore: PASS");
  console.log("[revision-history] Scheduled publication revision: PASS");
  console.log("[revision-history] Overlapping scheduler: PASS");
  console.log("[revision-history] Cleanup: PASS");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
