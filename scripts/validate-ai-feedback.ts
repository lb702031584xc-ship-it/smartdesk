/**
 * AI Feedback / Evaluation validation (Phase 45).
 * Usage: npm run validate:ai-feedback
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  assertDispositionConsistentWithStatus,
  FEEDBACK_FORBIDDEN_SIDE_EFFECTS,
  getAIEvaluationMetrics,
  getFeedbackAuditTrail,
  isValidDisposition,
  isValidReason,
  submitAssistanceFeedback,
} from "../src/lib/ai-feedback";
import { deleteFeedbackForAssistanceForTests } from "../src/lib/ai-feedback-store";
import {
  acceptAssistance,
  generateAssistance,
  rejectAssistance,
} from "../src/lib/ai-assistance";
import { deleteAIAssistanceForEntityForTests } from "../src/lib/ai-assistance-store";
import { deleteAISuggestionsForEntityForTests } from "../src/lib/ai-suggestions";
import { deleteEditorialTasksForEntityForTests } from "../src/lib/editorial-tasks";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";

const ARTICLE_ID = "zz-phase45-ai-feedback";
const ARTICLE_SLUG = "zz-phase45-ai-feedback";
const ACTOR = "phase45-feedback@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertFile(rel: string) {
  assert(fs.existsSync(path.join(process.cwd(), rel)), `exists ${rel}`);
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
}

async function cleanup() {
  // Delete assistance first after feedback cleanup — feedback keyed by assistance
  const { listAIAssistanceByEntity } = await import(
    "../src/lib/ai-assistance-store"
  );
  if (isDatabaseContentStore()) {
    const rows = await listAIAssistanceByEntity("article", ARTICLE_ID).catch(
      () => [],
    );
    for (const row of rows) {
      await deleteFeedbackForAssistanceForTests(row.id).catch(() => undefined);
    }
  }
  await deleteAIAssistanceForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteEditorialTasksForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(
    () => undefined,
  );
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      slug: ARTICLE_SLUG,
      title: "Phase 45 Feedback Fixture",
    },
    classification: { type: "guide", category: "chairs" },
    editorial: { intent: "commercial", summary: "Feedback test." },
    seo: {
      metaTitle: "Short",
      metaDescription: "Desc",
      primaryKeyword: "office chairs",
      secondaryKeywords: [],
    },
    publishing: { status: "draft" },
  };
}

async function main() {
  console.log("=== Phase 45 file presence ===");
  assertFile("src/types/ai-feedback.ts");
  assertFile("src/lib/ai-feedback.ts");
  assertFile("src/lib/ai-feedback-store.ts");
  assertFile("drizzle/0006_ai_assistance_feedback.sql");

  console.log("\n=== Pure: taxonomy + consistency ===");
  assert(isValidDisposition("accepted-as-is"), "disposition accepted-as-is");
  assert(
    isValidDisposition("accepted-with-edits"),
    "disposition accepted-with-edits",
  );
  assert(isValidDisposition("rejected"), "disposition rejected");
  assert(isValidDisposition("not-actionable"), "disposition not-actionable");
  assert(!isValidDisposition("accepted"), "boolean-ish accepted invalid");
  assert(isValidReason("too-generic"), "reason too-generic");
  assert(!isValidReason("bad-vibes"), "invalid reason rejected");

  assert(
    assertDispositionConsistentWithStatus("accepted", "accepted-as-is").ok,
    "accepted + as-is ok",
  );
  assert(
    assertDispositionConsistentWithStatus("accepted", "accepted-with-edits")
      .ok,
    "accepted + with-edits ok",
  );
  assert(
    !assertDispositionConsistentWithStatus("accepted", "rejected").ok,
    "accepted + rejected blocked",
  );
  assert(
    assertDispositionConsistentWithStatus("rejected", "rejected").ok,
    "rejected + rejected ok",
  );
  assert(
    assertDispositionConsistentWithStatus("rejected", "not-actionable").ok,
    "rejected + not-actionable ok",
  );
  assert(
    !assertDispositionConsistentWithStatus("draft", "accepted-as-is").ok,
    "draft feedback blocked",
  );

  assert(
    FEEDBACK_FORBIDDEN_SIDE_EFFECTS.includes("content-mutation"),
    "forbidden side effects documented",
  );

  if (!isDatabaseContentStore()) {
    console.log("\n=== DB tests skipped (filesystem store) ===");
    const metrics = await getAIEvaluationMetrics(10);
    assert(metrics.feedbackCount === 0, "empty evaluation without DB");
    assert(
      metrics.noFeedbackCount === 0,
      "no-feedback stays zero without eligible",
    );
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("\n=== Integration: feedback lifecycle ===");
  ensureActorAdmin();
  await cleanup();

  assert(
    (await createAdminArticle(testArticle(), { body: "# Phase 45\n" })).ok,
    "fixture article create",
  );

  const beforeTitle = (await getAdminArticle(ARTICLE_ID))?.article.identity
    .title;

  // Accept path → accepted-as-is / accepted-with-edits
  const seoGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(seoGen.success, "generate seo assistance");
  const seoId = seoGen.success ? seoGen.assistance.id : "";
  assert((await acceptAssistance(seoId, ACTOR)).success, "accept assistance");

  const badRejectOnAccepted = await submitAssistanceFeedback({
    assistanceId: seoId,
    disposition: "rejected",
    reason: "inaccurate",
    actor: ACTOR,
  });
  assert(!badRejectOnAccepted.success, "cannot mark rejected feedback on accepted");

  const asIs = await submitAssistanceFeedback({
    assistanceId: seoId,
    disposition: "accepted-as-is",
    reason: "useful-but-needs-editing",
    note: "minor polish later",
    actor: ACTOR,
  });
  assert(asIs.success, "accepted-as-is feedback");

  const withEdits = await submitAssistanceFeedback({
    assistanceId: seoId,
    disposition: "accepted-with-edits",
    reason: "too-generic",
    actor: ACTOR,
  });
  assert(withEdits.success, "update to accepted-with-edits");

  const trail = await getFeedbackAuditTrail(seoId);
  assert(trail.length >= 2, "audit trail has create + update");
  assert(
    trail.some((e) => e.action === "create"),
    "audit includes create",
  );
  assert(
    trail.some((e) => e.action === "update"),
    "audit includes update",
  );

  // Reject path → rejected / not-actionable
  const rejectGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "content-improvement",
    createdBy: ACTOR,
  });
  assert(rejectGen.success, "generate for reject");
  const rejectId = rejectGen.success ? rejectGen.assistance.id : "";
  assert((await rejectAssistance(rejectId, ACTOR)).success, "reject assistance");

  const badAcceptOnRejected = await submitAssistanceFeedback({
    assistanceId: rejectId,
    disposition: "accepted-as-is",
    reason: "inaccurate",
    actor: ACTOR,
  });
  assert(!badAcceptOnRejected.success, "cannot accepted-as-is on rejected");

  const rejectedFb = await submitAssistanceFeedback({
    assistanceId: rejectId,
    disposition: "rejected",
    reason: "wrong-intent",
    actor: ACTOR,
  });
  assert(rejectedFb.success, "rejected feedback");

  const naGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "internal-link",
    createdBy: ACTOR,
  });
  assert(naGen.success, "generate for not-actionable");
  const naId = naGen.success ? naGen.assistance.id : "";
  assert((await rejectAssistance(naId, ACTOR)).success, "reject for NA");
  const naFb = await submitAssistanceFeedback({
    assistanceId: naId,
    disposition: "not-actionable",
    reason: "duplicate",
    actor: ACTOR,
  });
  assert(naFb.success, "not-actionable feedback");

  // Validation
  assert(
    !(
      await submitAssistanceFeedback({
        assistanceId: seoId,
        disposition: "nope",
        reason: "inaccurate",
        actor: ACTOR,
      })
    ).success,
    "invalid disposition rejected",
  );
  assert(
    !(
      await submitAssistanceFeedback({
        assistanceId: seoId,
        disposition: "accepted-as-is",
        reason: "nope",
        actor: ACTOR,
      })
    ).success,
    "invalid reason rejected",
  );
  assert(
    !(
      await submitAssistanceFeedback({
        assistanceId: "missing-assistance-phase45",
        disposition: "accepted-as-is",
        reason: "inaccurate",
        actor: ACTOR,
      })
    ).success,
    "nonexistent assistance rejected",
  );
  assert(
    !(
      await submitAssistanceFeedback({
        assistanceId: seoId,
        disposition: "accepted-as-is",
        reason: "other",
        note: "",
        actor: ACTOR,
      })
    ).success,
    "other requires note",
  );

  // Metrics
  const metrics = await getAIEvaluationMetrics(100);
  assert(metrics.eligibleAssistanceCount >= 3, "eligible count");
  assert(metrics.feedbackCount >= 3, "feedback count");
  assert(metrics.feedbackCoverageRate !== null, "coverage computed");
  assert(
    metrics.noFeedbackCount >= 0,
    "no-feedback tracked separately from rejection",
  );
  assert(metrics.acceptedWithEditsCount >= 1, "with-edits counted");
  assert(metrics.rejectedCount >= 1, "rejection counted");
  assert(metrics.notActionableCount >= 1, "not-actionable counted");
  assert(
    metrics.byAssistanceType.some((t) => t.feedbackCount >= 1),
    "by assistance type",
  );
  assert(metrics.byReason.some((r) => r.count >= 1), "by reason");
  assert(
    metrics.outcomeJoins.every(
      (j) => j.linkage === "explicit" || j.linkage === "unknown",
    ),
    "joins use explicit|unknown only",
  );

  // Safety: no content mutation from feedback
  const after = await getAdminArticle(ARTICLE_ID);
  assert(
    after?.article.identity.title === beforeTitle,
    "feedback does not mutate article title",
  );
  assert(after?.article.identity.id === ARTICLE_ID, "canonical id unchanged");

  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
