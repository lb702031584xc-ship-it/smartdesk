/**
 * Editorial workflow validation (Phase 36).
 * Usage: npm run validate:editorial-workflow
 */
import "./load-env-local";
import {
  approveChange,
  assertWorkflowAllowsMutation,
  createWorkflowRecord,
  deleteEditorialWorkflowForTests,
  getWorkflowStatus,
  isValidWorkflowTransition,
  publishChange,
  reopenForEdit,
  submitForReview,
} from "../src/lib/editorial-workflow";
import { updateProductEditorialFields } from "../src/lib/product-mutations";
import {
  createAdminProduct,
  deleteAdminProductRecord,
  getAdminProduct,
} from "../src/lib/admin/product-store";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { isArticleCreateEnabled } from "../src/lib/admin/article-create-policy";
import type { ProductV1Document } from "../src/types/product-v1";
import type { ArticleV1 } from "../src/types/article-v1";

const PRODUCT_ID = "zz-phase36-workflow-product";
const ARTICLE_ID = "zz-phase36-workflow-article";
const ARTICLE_SLUG = "zz-phase36-workflow-article";
const EDITOR = "phase36-editor@smartdesksetup.com";
const REVIEWER = "phase36-reviewer@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function ensureRoleEnv() {
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  admins.add(EDITOR);
  admins.add(REVIEWER);
  process.env.ADMIN_EMAILS = [...admins].join(",");
  process.env.ADMIN_REVIEWER_EMAILS = REVIEWER;
}

async function cleanup() {
  await deleteEditorialWorkflowForTests("product", PRODUCT_ID).catch(() => undefined);
  await deleteEditorialWorkflowForTests("article", ARTICLE_ID).catch(() => undefined);
  await deleteAdminProductRecord(PRODUCT_ID).catch(() => undefined);
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(() => undefined);
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: PRODUCT_ID,
    identity: {
      name: "Phase 36 Workflow Product",
      brand: "SmartDesk Test",
      category: "accessories",
    },
    editorial: { verdict: "Before", role: "best-value" },
  };
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      title: "Phase 36 Workflow Article",
      slug: ARTICLE_SLUG,
    },
    classification: { type: "guide", category: "desks" },
    editorial: {
      intent: "informational",
      summary: "Workflow publish fixture.",
    },
    seo: {
      metaTitle: "Phase 36 fixture",
      metaDescription: "Editorial workflow validation article.",
      primaryKeyword: "workflow test",
    },
    publishing: { status: "draft", featured: false },
  };
}

async function main() {
  console.log("=== Pure transition rules ===");
  assert(isValidWorkflowTransition("draft", "submit"), "draft→submit allowed");
  assert(isValidWorkflowTransition("review", "approve"), "review→approve allowed");
  assert(isValidWorkflowTransition("approved", "publish"), "approved→publish allowed");
  assert(!isValidWorkflowTransition("draft", "publish"), "draft→publish rejected");
  assert(!isValidWorkflowTransition("review", "publish"), "review→publish rejected");
  assert(!isValidWorkflowTransition("draft", "approve"), "draft→approve rejected");

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("Editorial workflow validation passed (pure only).");
    return;
  }

  ensureRoleEnv();
  assert(isArticleCreateEnabled(), "article create enabled");

  console.log("=== Integration: product workflow ===");
  await cleanup();

  const createdProduct = await createAdminProduct(testProduct());
  assert(createdProduct.ok, "fixture product create");

  const created = await createWorkflowRecord({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: EDITOR,
  });
  assert(created.success, "create workflow");
  assert(
    created.success && created.workflow.record.status === "draft",
    "workflow starts as draft",
  );
  assert(
    created.success && created.workflow.history.length === 1,
    "create event in history",
  );

  const dup = await createWorkflowRecord({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: EDITOR,
  });
  assert(!dup.success && dup.error === "WORKFLOW_EXISTS", "duplicate workflow fails");

  const draftPublish = await publishChange({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: REVIEWER,
  });
  assert(
    !draftPublish.success && draftPublish.error === "INVALID_TRANSITION",
    "draft→publish rejected",
  );

  const editorCannotApprove = await approveChange({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: EDITOR,
  });
  assert(
    !editorCannotApprove.success &&
      editorCannotApprove.error === "PERMISSION_DENIED",
    "editor cannot approve",
  );

  const submitted = await submitForReview({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: EDITOR,
  });
  assert(
    submitted.success && submitted.workflow.record.status === "review",
    "submit for review",
  );

  const locked = await assertWorkflowAllowsMutation("product", PRODUCT_ID);
  assert(Boolean(locked), "mutations locked while in review");

  const productBefore = await getAdminProduct(PRODUCT_ID);
  const mutationBlocked = await updateProductEditorialFields({
    productId: PRODUCT_ID,
    changes: { editorial: { verdict: "should not save" } },
    expectedVersion: productBefore!.version ?? 1,
    actor: EDITOR,
  });
  assert(
    !mutationBlocked.success && mutationBlocked.error === "WORKFLOW_LOCKED",
    "mutation boundary respects workflow lock",
  );

  const approved = await approveChange({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: REVIEWER,
  });
  assert(
    approved.success && approved.workflow.record.status === "approved",
    "approve change",
  );

  const published = await publishChange({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: REVIEWER,
  });
  assert(
    published.success && published.workflow.record.status === "published",
    "publish change",
  );

  const view = await getWorkflowStatus("product", PRODUCT_ID);
  assert(Boolean(view), "getWorkflowStatus returns record");
  assert(
    (view?.history.length ?? 0) >= 4,
    "audit history has create/submit/approve/publish",
  );
  assert(
    Boolean(
      view?.history.some((e) => e.actor === REVIEWER && e.action === "approve"),
    ),
    "approve actor recorded",
  );

  const reopened = await reopenForEdit({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: EDITOR,
  });
  assert(
    reopened.success && reopened.workflow.record.status === "draft",
    "reopen published → draft",
  );

  console.log("=== Integration: article workflow + publish ===");
  const createdArticle = await createAdminArticle(testArticle(), {
    body: "# Phase 36\n\nPublishable guide body for workflow validation.\n",
  });
  assert(createdArticle.ok, `fixture article create: ${createdArticle.errors?.join("; ") ?? ""}`);

  const articleWf = await createWorkflowRecord({
    entityType: "article",
    entityId: ARTICLE_ID,
    actor: EDITOR,
  });
  assert(articleWf.success, "article workflow create");

  assert(
    (
      await submitForReview({
        entityType: "article",
        entityId: ARTICLE_ID,
        actor: EDITOR,
      })
    ).success,
    "article submit",
  );
  assert(
    (
      await approveChange({
        entityType: "article",
        entityId: ARTICLE_ID,
        actor: REVIEWER,
      })
    ).success,
    "article approve",
  );

  const articlePublish = await publishChange({
    entityType: "article",
    entityId: ARTICLE_ID,
    actor: REVIEWER,
  });
  assert(articlePublish.success, `article publish: ${!articlePublish.success ? articlePublish.message : ""}`);
  assert(
    articlePublish.success && articlePublish.workflow.record.status === "published",
    "article workflow published",
  );

  const afterArticle = await getAdminArticle(ARTICLE_ID);
  assert(
    afterArticle?.article.publishing.status === "published",
    "article publishing.status set via existing save path",
  );

  await cleanup();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Editorial workflow validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
