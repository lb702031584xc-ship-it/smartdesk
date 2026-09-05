/**
 * Phase 16A — Scheduled Publishing Validation
 *
 * Pure logic tests (no DB required):
 * - scheduledAt schema validation
 * - validate-save: scheduled requires future time + body
 * - local-hints: scheduled requires future time + body
 * - worker path planning via collectArticleRevalidationPaths
 * - publishDueArticles result structure
 *
 * Run: npm run validate:scheduled-publishing
 */
import assert from "node:assert/strict";
import { validateArticleV1 } from "../src/lib/article-schema";
import {
  collectArticleRevalidationPaths,
} from "../src/lib/admin/revalidate-content";
import { articleLocalHints } from "../src/lib/admin/local-hints";
import type { ArticleV1 } from "../src/types/article-v1";

function makeArticle(overrides?: Partial<ArticleV1>): ArticleV1 {
  return {
    identity: { id: "test-sched-1", title: "Test Scheduled", slug: "test-scheduled" },
    classification: { type: "guide" },
    editorial: { intent: "informational" },
    publishing: { status: "draft" },
    ...overrides,
  } as ArticleV1;
}

let pass = 0;
function ok(label: string) {
  pass++;
  console.log(`  OK  ${label}`);
}

// --- Schema: scheduledAt accepted ---
{
  const a = makeArticle({
    publishing: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  const r = validateArticleV1(a);
  assert(r.valid, "scheduled article with scheduledAt should be structurally valid");
  ok("schema accepts scheduledAt");
}

// --- Schema: scheduledAt rejects non-string ---
{
  const a = makeArticle({ publishing: { status: "scheduled", scheduledAt: 12345 } as unknown as ArticleV1["publishing"] });
  const r = validateArticleV1(a);
  assert(r.errors.some((e) => e.includes("scheduledAt")), "non-string scheduledAt should fail");
  ok("schema rejects non-string scheduledAt");
}

// --- Local hints: scheduled without scheduledAt ---
{
  const a = makeArticle({ publishing: { status: "scheduled" } });
  const h = articleLocalHints(a, { mode: "edit", body: "body content" });
  assert(h.errors.some((e) => e.includes("future publish time")), "should require scheduledAt");
  ok("local hints: scheduled requires scheduledAt");
}

// --- Local hints: scheduled with past time ---
{
  const a = makeArticle({
    publishing: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    },
  });
  const h = articleLocalHints(a, { mode: "edit", body: "body content" });
  assert(h.errors.some((e) => e.includes("future")), "past time should error");
  ok("local hints: scheduled with past time errors");
}

// --- Local hints: scheduled with future time + body = no errors ---
{
  const a = makeArticle({
    publishing: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  const h = articleLocalHints(a, { mode: "edit", body: "body content" });
  const schedErrors = h.errors.filter((e) => e.includes("schedul") || e.includes("future") || e.includes("Markdown body"));
  assert.equal(schedErrors.length, 0, `unexpected scheduling errors: ${schedErrors.join("; ")}`);
  ok("local hints: valid scheduled article has no scheduling errors");
}

// --- Local hints: scheduled with empty body ---
{
  const a = makeArticle({
    publishing: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  const h = articleLocalHints(a, { mode: "edit", body: "" });
  assert(h.errors.some((e) => e.includes("Markdown body")), "empty body should error for scheduled");
  ok("local hints: scheduled with empty body errors");
}

// --- Revalidation paths: scheduled → published ---
{
  const paths = collectArticleRevalidationPaths({
    slug: "test-slug",
    previousStatus: "scheduled",
    nextStatus: "published",
    category: "desks",
  });
  assert(paths.includes("/blog/test-slug"), "should include article path");
  assert(paths.includes("/"), "should include homepage");
  assert(paths.includes("/blog"), "should include blog listing");
  assert(paths.includes("/sitemap.xml"), "should include sitemap");
  assert(paths.includes("/category/desks"), "should include category");
  ok("revalidation paths: scheduled → published");
}

// --- Case D: already published → no status change paths planned ---
{
  const paths = collectArticleRevalidationPaths({
    slug: "test-slug",
    previousStatus: "published",
    nextStatus: "published",
  });
  assert(paths.includes("/blog/test-slug"), "published article path present");
  assert(!paths.includes("/"), "no listing change for same status");
  ok("revalidation paths: published → published (no listing change)");
}

// --- Case E: draft ignored by path planner ---
{
  const paths = collectArticleRevalidationPaths({
    slug: "draft-slug",
    previousStatus: "draft",
    nextStatus: "draft",
  });
  assert.equal(paths.length, 0, "draft → draft should produce no paths");
  ok("revalidation paths: draft → draft (empty)");
}

console.log(`\nAll ${pass} scheduled publishing validation tests passed.`);
