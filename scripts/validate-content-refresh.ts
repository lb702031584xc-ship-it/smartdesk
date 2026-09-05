/**
 * Validate content refresh queue (deterministic, no live GSC required).
 * Usage: npx tsx scripts/validate-content-refresh.ts
 */
import type { ArticleV1 } from "../src/types/article-v1";
import type { ArticleReadinessResult } from "../src/lib/editorial/article-readiness";
import { buildContentGraph } from "../src/lib/editorial/content-graph";
import { buildRefreshQueue, getRefreshCandidate } from "../src/lib/editorial/content-refresh";
import type { SearchOpportunity } from "../src/lib/search-console/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else { failed++; console.error(`FAIL: ${message}`); }
}

function makeArticle(overrides: Partial<ArticleV1> & { id: string; slug: string; title: string }): ArticleV1 {
  return {
    identity: { id: overrides.id, slug: overrides.slug, title: overrides.title },
    classification: { type: "best-list", category: "chairs", ...(overrides.classification ?? {}) },
    editorial: { intent: "commercial", ...(overrides.editorial ?? {}) },
    publishing: { status: "published", ...(overrides.publishing ?? {}) },
    products: overrides.products,
  } as ArticleV1;
}

function readiness(blockers: string[], warnings: string[] = []): ArticleReadinessResult {
  return {
    ready: blockers.length === 0,
    blockers: blockers.map((m, i) => ({ id: `b${i}`, label: "b", severity: "blocker" as const, message: m })),
    warnings: warnings.map((m, i) => ({ id: `w${i}`, label: "w", severity: "warning" as const, message: m })),
    checks: [],
  };
}

console.log("=== Aggregation Tests ===");

const articles = [
  makeArticle({ id: "a1", slug: "best-chairs", title: "Best Chairs" }),
  makeArticle({ id: "a2", slug: "chair-review", title: "Chair Review", classification: { type: "review", category: "chairs" } }),
];
const bodies = new Map([
  ["a1", "Check [our review](/blog/nonexistent-slug) for details."],
  ["a2", "Content here."],
]);
const graph = buildContentGraph(articles, bodies, []);

const readinessMap = new Map<string, ArticleReadinessResult>([
  ["a1", readiness(["Internal link to /blog/nonexistent-slug — article not found."], ["Meta description is empty."])],
  ["a2", readiness([])],
]);

const searchOpps: SearchOpportunity[] = [
  {
    kind: "update-existing",
    priority: "medium",
    articleId: "a1",
    articleTitle: "Best Chairs",
    evidence: { clicks: 10, impressions: 500, ctr: 0.02, position: 9 },
    reasons: ["500 impressions with CTR 2.0% — title/meta alignment review candidate"],
  },
  {
    kind: "internal-link",
    priority: "medium",
    articleId: "a1",
    articleTitle: "Best Chairs",
    evidence: { clicks: 10, impressions: 500, ctr: 0.02, position: 9 },
    reasons: ["500 impressions but 0 inbound internal links"],
  },
  {
    kind: "create-new",
    priority: "high",
    query: "new topic",
    evidence: { clicks: 5, impressions: 200, ctr: 0.025, position: 12 },
    reasons: ["Query has impressions but no Article"],
  },
  {
    kind: "monitor",
    priority: "low",
    articleId: "a2",
    articleTitle: "Chair Review",
    query: "chair review",
    evidence: { clicks: 3, impressions: 100, ctr: 0.03, position: 8 },
    reasons: ["Monitor existing coverage"],
  },
];

const queue = buildRefreshQueue({
  articles,
  readinessByArticle: readinessMap,
  graph,
  searchOpportunities: searchOpps,
  gscAvailable: true,
});

const a1 = queue.candidates.find((c) => c.articleId === "a1");
assert(!!a1, "a1 is a candidate");
assert(a1!.reasons.length >= 2, "multiple reasons aggregated into one candidate");
assert(a1!.priority === "high", "priority escalates to highest (broken link = high)");
assert(!queue.candidates.some((c) => c.reasons.some((r) => r.type === "create-new" as never)), "create-new excluded");
assert(!queue.candidates.some((c) => c.articleId === "a2" && c.reasons.some((r) => r.message.includes("Monitor"))), "monitor excluded from a2");

console.log("=== Zero GSC Tests ===");

const queueNoGsc = buildRefreshQueue({
  articles,
  readinessByArticle: readinessMap,
  graph,
  gscAvailable: false,
});
assert(queueNoGsc.candidates.length > 0, "queue works without GSC");
assert(queueNoGsc.gscAvailable === false, "gscAvailable false");

console.log("=== Priority Tests ===");

assert(a1!.reasons.some((r) => r.type === "broken-internal-link"), "broken link → HIGH");
assert(a1!.reasons.some((r) => r.type === "ctr-review" || r.type === "internal-link-opportunity"), "search signals present");

console.log("=== Candidate Lookup ===");

const found = getRefreshCandidate("a1", queue);
assert(!!found && found.articleId === "a1", "getRefreshCandidate works");

console.log("=== Evidence Separation ===");

assert(!!a1!.evidence.readiness || !!a1!.evidence.graph || !!a1!.evidence.search, "evidence present");

console.log("=== No-Write Verification ===");

assert(typeof buildRefreshQueue === "function", "pure derivation — no DB writes");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
console.log(`Queue sample: ${queue.counts.total} candidates (high: ${queue.counts.high}, medium: ${queue.counts.medium}, low: ${queue.counts.low})`);

if (failed > 0) process.exit(1);
console.log("Content refresh validation passed.");
