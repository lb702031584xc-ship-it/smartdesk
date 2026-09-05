/**
 * Editorial Activity & Change Intelligence validation (Phase 37).
 * Usage: npm run validate:editorial-intelligence
 *
 * Read-only checks against revisions + workflow events.
 */
import "./load-env-local";
import {
  buildAllowedFieldDiffs,
  getChangeSummaries,
  getEditorialDiff,
  getPendingReviewItems,
  getPublishedChanges,
  getRecentEditorialActivity,
  getStaleArticles,
} from "../src/lib/editorial-activity";
import {
  getChangeSummaryViewModel,
  getEditorialActivityViewModel,
  getEditorialIntelligenceOverview,
  getReviewQueueViewModel,
} from "../src/lib/editorial-dashboard";
import {
  createWorkflowRecord,
  deleteEditorialWorkflowForTests,
  submitForReview,
} from "../src/lib/editorial-workflow";
import { updateProductEditorialFields } from "../src/lib/product-mutations";
import {
  createAdminProduct,
  deleteAdminProductRecord,
  getAdminProduct,
} from "../src/lib/admin/product-store";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ProductV1Document } from "../src/types/product-v1";

const PRODUCT_ID = "zz-phase37-activity-product";
const ACTOR = "phase37-activity@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function ensureActorAdmin() {
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  admins.add(ACTOR);
  process.env.ADMIN_EMAILS = [...admins].join(",");
  // Solo-operator: empty reviewers → ACTOR is reviewer too
  if (!process.env.ADMIN_REVIEWER_EMAILS?.trim()) {
    process.env.ADMIN_REVIEWER_EMAILS = "";
  }
}

async function cleanup() {
  await deleteEditorialWorkflowForTests("product", PRODUCT_ID).catch(() => undefined);
  await deleteAdminProductRecord(PRODUCT_ID).catch(() => undefined);
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: PRODUCT_ID,
    identity: {
      name: "Phase 37 Activity Fixture",
      brand: "SmartDesk Test",
      category: "accessories",
    },
    editorial: {
      role: "best-value",
      verdict: "Before activity verdict",
      bestFor: ["labs"],
      notFor: ["warehouses"],
    },
  };
}

async function main() {
  console.log("=== Pure: allowed field diffs ===");
  const before = testProduct();
  const after = {
    ...before,
    editorial: {
      ...before.editorial,
      verdict: "After activity verdict",
      role: "best-overall" as const,
    },
  };
  const diffs = buildAllowedFieldDiffs("product", before, after);
  assert(diffs.some((d) => d.field === "editorial.verdict"), "verdict diff");
  assert(diffs.some((d) => d.field === "editorial.role"), "role diff");
  assert(
    !diffs.some((d) => d.field.includes("identity")),
    "identity not in allowlisted diffs",
  );

  const commerceLeak = buildAllowedFieldDiffs(
    "product",
    before,
    {
      ...after,
      commerce: { asin: "B00LEAKEDXX" },
    },
  );
  assert(
    !commerceLeak.some((d) => d.field.includes("asin") || d.field.includes("commerce")),
    "commerce/asin excluded from change intelligence",
  );

  console.log("=== Dashboard resolvers (empty-safe) ===");
  const overview = await getEditorialIntelligenceOverview();
  assert(Array.isArray(overview.recentActivity), "overview.recentActivity");
  assert(typeof overview.reviewQueue.pendingCount === "number", "review queue count");
  assert(Array.isArray(overview.recentChanges), "overview.recentChanges");
  assert(Array.isArray(overview.recentlyPublished), "overview.recentlyPublished");
  assert(Array.isArray(overview.staleArticles), "overview.staleArticles");

  const activity = await getEditorialActivityViewModel(10);
  assert(Array.isArray(activity), "activity view model");
  if (activity.length >= 2) {
    assert(
      activity[0]!.timestamp >= activity[1]!.timestamp,
      "activity ordered newest first",
    );
  }

  const queue = await getReviewQueueViewModel();
  assert(Array.isArray(queue.items), "review queue items");
  assert(queue.pendingCount === queue.items.length, "pendingCount matches items");

  const changes = await getChangeSummaryViewModel(10);
  assert(Array.isArray(changes), "change summaries");

  const stale = await getStaleArticles(0);
  assert(Array.isArray(stale), "stale articles with 0-day threshold");

  const missingDiff = await getEditorialDiff(
    "product",
    "does-not-exist-phase37",
    "no-revision",
  );
  assert(missingDiff === undefined, "missing entity diff returns undefined");

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration writes: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("Editorial intelligence validation passed (pure + empty-safe).");
    return;
  }

  ensureActorAdmin();
  console.log("=== Integration: seed activity + review queue ===");
  await cleanup();

  const created = await createAdminProduct(testProduct());
  assert(created.ok, "fixture product create");

  const beforeRec = await getAdminProduct(PRODUCT_ID);
  const mut = await updateProductEditorialFields({
    productId: PRODUCT_ID,
    changes: {
      editorial: {
        verdict: "Phase 37 controlled change",
        role: "best-overall",
      },
    },
    expectedVersion: beforeRec!.version ?? 1,
    actor: ACTOR,
  });
  assert(mut.success, "editorial mutation for activity feed");

  const wf = await createWorkflowRecord({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: ACTOR,
  });
  assert(wf.success, "workflow create for review queue");
  const submitted = await submitForReview({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: ACTOR,
  });
  assert(submitted.success, "submit for review");

  const activityAfter = await getRecentEditorialActivity(50);
  assert(
    activityAfter.some(
      (a) => a.entityId === PRODUCT_ID && a.action === "revision" && a.actor === ACTOR,
    ),
    "activity includes revision with actor",
  );
  assert(
    activityAfter.some(
      (a) => a.entityId === PRODUCT_ID && a.action === "workflow_submit",
    ),
    "activity includes workflow submit",
  );
  assert(
    activityAfter.every((a) => a.entityName.length > 0 && a.actor.length > 0),
    "activity rows have entityName and actor",
  );

  const reviewAfter = await getPendingReviewItems();
  assert(
    reviewAfter.items.some((i) => i.entityId === PRODUCT_ID && i.currentStatus === "review"),
    "review queue includes submitted product",
  );

  const changeAfter = await getChangeSummaries(50);
  const productChange = changeAfter.find((c) => c.entityId === PRODUCT_ID);
  assert(Boolean(productChange), "change summary for product mutation");
  assert(
    Boolean(productChange?.changedFields.includes("editorial.verdict")),
    "change summary lists editorial.verdict",
  );
  assert(
    Boolean(
      productChange?.diffs.some(
        (d) =>
          d.field === "editorial.verdict" &&
          d.after === "Phase 37 controlled change",
      ),
    ),
    "diff after value for verdict",
  );

  if (mut.success && mut.revisionId) {
    const diffVm = await getEditorialDiff("product", PRODUCT_ID, mut.revisionId);
    assert(Boolean(diffVm), "editorial diff view model resolves");
    assert(
      Boolean(diffVm?.diffs.some((d) => d.field === "editorial.verdict")),
      "diff view includes verdict",
    );
  }

  const published = await getPublishedChanges(20);
  assert(Array.isArray(published), "published changes resolves");

  await cleanup();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Editorial intelligence validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
