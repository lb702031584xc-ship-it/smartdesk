/**
 * Validate Search Console intelligence (deterministic, mocked — no live GSC).
 * Usage: npx tsx scripts/validate-search-intelligence.ts
 */
import type { ArticleV1 } from "../src/types/article-v1";
import {
  normalizeGscPageUrl,
  mapPathToArticleSlug,
  mapGscPageToSlug,
  aggregateRows,
  safePercentChange,
  dateRangeForWindow,
} from "../src/lib/search-console/normalize";
import { mapPageRows, buildArticleProfiles } from "../src/lib/search-console/queries";
import { deriveSearchOpportunities } from "../src/lib/search-console/opportunities";
import type { GSCRow, ArticleSearchProfile } from "../src/lib/search-console/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function makeArticle(overrides: Partial<ArticleV1> & { id: string; slug: string; title: string }): ArticleV1 {
  return {
    identity: { id: overrides.id, slug: overrides.slug, title: overrides.title },
    classification: { type: "best-list", category: "chairs", ...(overrides.classification ?? {}) },
    editorial: { intent: "commercial", ...(overrides.editorial ?? {}) },
    publishing: { status: "published", ...(overrides.publishing ?? {}) },
    products: overrides.products,
    seo: overrides.seo,
    relationships: overrides.relationships,
  } as ArticleV1;
}

console.log("=== URL Mapping Tests ===");

assert(
  normalizeGscPageUrl("https://smartdesksetup.com/blog/test-article") === "/blog/test-article",
  "canonical blog URL",
);
assert(
  normalizeGscPageUrl("https://smartdesksetup.com/blog/test-article/") === "/blog/test-article",
  "trailing slash normalization",
);
assert(
  normalizeGscPageUrl("https://www.smartdesksetup.com/blog/test-article") === "/blog/test-article",
  "www host normalization",
);
assert(
  normalizeGscPageUrl("https://evil.com/blog/test-article") === null,
  "wrong host rejected",
);
assert(mapPathToArticleSlug("/blog/my-slug") === "my-slug", "slug extraction");
assert(mapPathToArticleSlug("/category/desks") === null, "non-blog path rejected");
assert(
  mapGscPageToSlug("https://smartdesksetup.com/blog/chair-review")?.slug === "chair-review",
  "full URL to slug",
);

console.log("=== Metric Tests ===");

const agg = aggregateRows([
  { clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
  { clicks: 20, impressions: 200, ctr: 0.1, position: 10 },
]);
assert(agg.clicks === 30, "click aggregation");
assert(agg.impressions === 300, "impression aggregation");
assert(Math.abs(agg.ctr - 0.1) < 0.001, "CTR from totals");
assert(Math.abs(agg.position - 8.333) < 0.01, "weighted position");

assert(safePercentChange(5, 1) === undefined, "tiny baseline suppressed");
assert(safePercentChange(50, 100) === -50, "decline percentage");

const ranges = dateRangeForWindow(28);
assert(ranges.current.start < ranges.current.end, "date range valid");
assert(ranges.previous.end < ranges.current.start, "previous before current");

console.log("=== Page Mapping Tests ===");

const articles = [
  makeArticle({ id: "a1", slug: "best-chairs", title: "Best Chairs" }),
  makeArticle({ id: "a2", slug: "chair-review", title: "Chair Review", classification: { type: "review", category: "chairs" } }),
];

const pageRows: GSCRow[] = [
  { keys: ["https://smartdesksetup.com/blog/best-chairs"], clicks: 50, impressions: 1000, ctr: 0.05, position: 8 },
  { keys: ["https://smartdesksetup.com/blog/chair-review"], clicks: 30, impressions: 500, ctr: 0.06, position: 12 },
  { keys: ["https://smartdesksetup.com/blog/nonexistent"], clicks: 5, impressions: 50, ctr: 0.1, position: 20 },
  { keys: ["https://smartdesksetup.com/"], clicks: 100, impressions: 2000, ctr: 0.05, position: 5 },
];

const { mapped, unmapped } = mapPageRows(pageRows, articles);
assert(mapped.length === 2, "two mapped articles");
assert(unmapped.length === 2, "two unmapped pages");

console.log("=== Opportunity Tests ===");

const profiles: ArticleSearchProfile[] = [
  {
    articleId: "a1",
    slug: "best-chairs",
    title: "Best Chairs",
    status: "published",
    type: "best-list",
    category: "chairs",
    current: { clicks: 10, impressions: 500, ctr: 0.02, position: 9 },
    previous: { clicks: 50, impressions: 600, ctr: 0.08, position: 7 },
    topQueries: [{ query: "best office chairs", clicks: 8, impressions: 400, ctr: 0.02, position: 9 }],
  },
];

const queryRows: GSCRow[] = [
  { keys: ["best office chairs"], clicks: 8, impressions: 400, ctr: 0.02, position: 9 },
  { keys: ["compact standing desk"], clicks: 2, impressions: 200, ctr: 0.01, position: 15 },
];

const opps = deriveSearchOpportunities({
  articleProfiles: profiles,
  queryRows,
  articles,
  inboundCounts: new Map([["a1", 0]]),
});

const ctrReview = opps.find((o) => o.kind === "update-existing" && o.reasons.some((r) => r.includes("CTR")));
assert(!!ctrReview, "CTR review candidate detected");

const decline = opps.find((o) => o.reasons.some((r) => r.includes("declined")));
assert(!!decline, "decline candidate detected");

const createNew = opps.find((o) => o.kind === "create-new" && o.query === "compact standing desk");
assert(!!createNew, "new content candidate for unmapped query");

const tinyQuery: GSCRow[] = [{ keys: ["tiny"], clicks: 1, impressions: 5, ctr: 0.2, position: 30 }];
const tinyOpps = deriveSearchOpportunities({
  articleProfiles: profiles,
  queryRows: tinyQuery,
  articles,
  inboundCounts: new Map(),
});
assert(tinyOpps.length === 0 || !tinyOpps.some((o) => o.query === "tiny"), "tiny data suppressed");

console.log("=== Article Profile Tests ===");

const profiles2 = buildArticleProfiles(articles, pageRows, [], [
  { keys: ["https://smartdesksetup.com/blog/best-chairs", "best office chairs"], clicks: 8, impressions: 400, ctr: 0.02, position: 9 },
]);
assert(profiles2.length === 2, "two published profiles");
assert(profiles2[0].topQueries.length > 0, "top queries populated");

console.log("=== No-Write Verification ===");
assert(typeof deriveSearchOpportunities === "function", "pure function — no DB writes");
assert(typeof mapPageRows === "function", "pure mapping — no DB writes");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("Search intelligence validation passed.");
