/**
 * Article metadata mutation boundary validation (Phase 35).
 * Usage: npm run validate:article-mutations
 */
import "./load-env-local";
import {
  applyArticleMetadataChanges,
  updateArticleMetadataFields,
  validateArticleMetadataChanges,
} from "../src/lib/article-mutations";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { collectArticleRevalidationPaths } from "../src/lib/admin/revalidate-content";
import { countArticleRevisions, listArticleRevisions } from "../src/lib/db/revisions";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { isArticleCreateEnabled } from "../src/lib/admin/article-create-policy";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_ID = "zz-phase35-article-mutation";
const TEST_SLUG = "zz-phase35-article-mutation";
const TEST_BODY = "# Phase 35 fixture\n\nMarkdown must not change.\n";
const ACTOR = "phase35-mutation@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

async function cleanup() {
  await deleteAdminArticleRecord(TEST_ID, TEST_SLUG).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: TEST_ID,
      title: "Phase 35 Mutation Fixture",
      slug: TEST_SLUG,
    },
    classification: { type: "guide", category: "desks" },
    editorial: {
      intent: "informational",
      summary: "Before summary",
      audience: ["renters"],
      methodology: "Must remain unchanged",
    },
    seo: {
      metaTitle: "Before title",
      metaDescription: "Before description",
      primaryKeyword: "before keyword",
      secondaryKeywords: ["a"],
      canonical: "https://example.com/keep",
    },
    products: {
      primary: [{ productId: "flexispot-compact", rank: 1 }],
    },
    relationships: {
      parentTopic: "desks",
      relatedArticles: ["best-small-desks-apartments-2026"],
    },
    publishing: { status: "draft", featured: false },
  };
}

async function main() {
  console.log("=== Pure: allowed / forbidden field validation ===");

  const okMeta = validateArticleMetadataChanges({
    editorial: {
      summary: "New summary",
      audience: ["apartments"],
      intent: "commercial",
    },
    seo: {
      metaTitle: "New title",
      metaDescription: "New desc",
      primaryKeyword: "standing desk",
      secondaryKeywords: ["compact"],
    },
  });
  assert(okMeta.ok, "allowed metadata update validates");

  const markdown = validateArticleMetadataChanges({
    editorial: { summary: "x" },
    body: "# hacked markdown",
  });
  assert(!markdown.ok && markdown.error === "FIELD_NOT_EDITABLE", "markdown/body update fails");

  const productRefs = validateArticleMetadataChanges({
    products: { primary: [{ productId: "x" }] },
  });
  assert(
    !productRefs.ok && productRefs.error === "FIELD_NOT_EDITABLE",
    "productRefs update fails",
  );

  const slug = validateArticleMetadataChanges({
    identity: { slug: "hijacked" },
  });
  assert(!slug.ok && slug.error === "FIELD_NOT_EDITABLE", "slug update fails");

  const relationships = validateArticleMetadataChanges({
    relationships: { parentTopic: "chairs" },
  });
  assert(
    !relationships.ok && relationships.error === "FIELD_NOT_EDITABLE",
    "relationship update fails",
  );

  const publishing = validateArticleMetadataChanges({
    publishing: { status: "published" },
  });
  assert(
    !publishing.ok && publishing.error === "FIELD_NOT_EDITABLE",
    "publishing update fails",
  );

  const badIntent = validateArticleMetadataChanges({
    editorial: { intent: "not-an-intent" },
  });
  assert(!badIntent.ok && badIntent.error === "INVALID_ENUM", "invalid intent fails");

  const methodology = validateArticleMetadataChanges({
    editorial: { methodology: "nope" },
  });
  assert(
    !methodology.ok && methodology.error === "FIELD_NOT_EDITABLE",
    "editorial.methodology not Phase 35 editable",
  );

  const base = testArticle();
  const merged = applyArticleMetadataChanges(base, {
    editorial: { summary: "After summary", intent: "commercial" },
    seo: { metaTitle: "After title", primaryKeyword: "after" },
  });
  assert(merged.editorial.summary === "After summary", "merge updates summary");
  assert(merged.editorial.intent === "commercial", "merge updates intent");
  assert(merged.editorial.methodology === "Must remain unchanged", "methodology preserved");
  assert(merged.seo?.metaTitle === "After title", "merge updates metaTitle");
  assert(merged.seo?.canonical === "https://example.com/keep", "canonical preserved");
  assert(merged.identity.slug === TEST_SLUG, "slug preserved");
  assert(
    merged.products?.primary?.[0]?.productId === "flexispot-compact",
    "product refs preserved",
  );
  assert(merged.relationships?.parentTopic === "desks", "relationships preserved");
  assert(merged.publishing.status === "draft", "publishing preserved");

  console.log("=== Dependency revalidation planning ===");
  const paths = collectArticleRevalidationPaths({
    slug: "best-office-chairs-small-spaces-2026",
    previousStatus: "published",
    nextStatus: "published",
    category: "chairs",
  });
  assert(
    paths.includes("/blog/best-office-chairs-small-spaces-2026"),
    "metadata save plans article route revalidation",
  );

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration writes: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("Article mutations validation passed (pure + dependency planning).");
    return;
  }

  assert(isArticleCreateEnabled(), "article create enabled for integration");

  console.log("=== Integration: mutation write path ===");
  await cleanup();

  const created = await createAdminArticle(testArticle(), { body: TEST_BODY });
  assert(created.ok, `fixture article create: ${created.errors?.join("; ") ?? ""}`);
  const before = await getAdminArticle(TEST_ID);
  assert(Boolean(before), "fixture article loaded");
  assert(before?.body === TEST_BODY, "fixture body stored");
  assert((await countArticleRevisions(TEST_ID)) === 0, "no revisions on create");

  const missing = await updateArticleMetadataFields({
    articleId: "does-not-exist-phase35",
    changes: { editorial: { summary: "x" } },
    expectedVersion: 1,
    actor: ACTOR,
  });
  assert(!missing.success && missing.error === "ARTICLE_NOT_FOUND", "missing article fails");

  const forbiddenBody = await updateArticleMetadataFields({
    articleId: TEST_ID,
    changes: { body: "# should fail", editorial: { summary: "nope" } },
    expectedVersion: before!.version ?? 1,
    actor: ACTOR,
  });
  assert(
    !forbiddenBody.success && forbiddenBody.error === "FIELD_NOT_EDITABLE",
    "forbidden markdown update fails before write",
  );

  const stale = await updateArticleMetadataFields({
    articleId: TEST_ID,
    changes: { editorial: { summary: "stale" } },
    expectedVersion: (before!.version ?? 1) - 1,
    actor: ACTOR,
  });
  assert(!stale.success && stale.error === "VERSION_CONFLICT", "stale version fails");

  const ok = await updateArticleMetadataFields({
    articleId: TEST_ID,
    changes: {
      editorial: {
        summary: "After controlled mutation",
        audience: ["tiny offices"],
        intent: "commercial",
      },
      seo: {
        metaTitle: "After SEO title",
        metaDescription: "After SEO description",
        primaryKeyword: "small standing desk",
        secondaryKeywords: ["compact desk"],
      },
    },
    expectedVersion: before!.version ?? 1,
    actor: ACTOR,
  });
  assert(ok.success, `valid metadata update succeeds: ${!ok.success ? ok.message : ""}`);
  if (ok.success) {
    assert(ok.revisionCreated, "revision created on metadata change");
    assert(typeof ok.revisionId === "string" && ok.revisionId.length > 0, "revisionId returned");
    assert(ok.updatedArticle.editorial.summary === "After controlled mutation", "summary saved");
    assert(ok.updatedArticle.editorial.intent === "commercial", "intent saved");
    assert(ok.updatedArticle.seo?.metaTitle === "After SEO title", "metaTitle saved");
    assert(
      ok.updatedArticle.editorial.methodology === "Must remain unchanged",
      "methodology intact",
    );
    assert(ok.updatedArticle.identity.slug === TEST_SLUG, "slug intact after save");
    assert(
      ok.updatedArticle.products?.primary?.[0]?.productId === "flexispot-compact",
      "products intact",
    );
    assert(Array.isArray(ok.dependencyPaths), "dependencyPaths present");
  }

  const after = await getAdminArticle(TEST_ID);
  assert(after?.body === TEST_BODY, "markdown body unchanged after metadata mutation");

  const revisions = await listArticleRevisions(TEST_ID);
  assert(revisions.length === 1, "one revision after mutation");
  assert(revisions[0]!.createdBy === ACTOR, "actor recorded on revision");
  assert(
    revisions[0]!.data.editorial.summary === "Before summary",
    "revision snapshot preserves previous editorial",
  );
  assert(revisions[0]!.body === TEST_BODY, "revision body snapshot matches prior markdown");

  await cleanup();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Article mutations validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
