/**
 * Phase 23 — Commerce verification workflow validation (deterministic, no Amazon network).
 * Usage: npx tsx scripts/validate-commerce-verification.ts
 */
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";
import {
  classifyAmazonUrlType,
  getCanonicalDateString,
  hasDetailUrlSuggestion,
  suggestAmazonDetailUrl,
} from "../src/lib/editorial/commerce-verification";
import {
  buildProductMaintenanceQueue,
} from "../src/lib/editorial/product-maintenance";
import {
  flattenMaterialChangeFields,
  getProductMaterialChanges,
  hasProductMaterialChanges,
} from "../src/lib/editorial/product-material-change";
import { buildProductMaterialChangeContext } from "../src/lib/editorial/product-impact-context";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function product(
  partial: Partial<ProductV1Document> & {
    id: string;
    name: string;
    category: ProductV1Document["identity"]["category"];
  },
): ProductV1Document {
  return {
    schemaVersion: 1,
    id: partial.id,
    identity: { name: partial.name, brand: "Test", category: partial.category },
    commerce: partial.commerce,
    media: partial.media,
    editorial: partial.editorial,
    review: partial.review,
    specs: partial.specs,
  } as ProductV1Document;
}

function article(
  id: string,
  slug: string,
  title: string,
  productIds: string[],
  type: ArticleV1["classification"]["type"] = "best-list",
  status: ArticleV1["publishing"]["status"] = "published",
): ArticleV1 {
  return {
    identity: { id, slug, title },
    classification: { type, category: "chairs" },
    editorial: { intent: "commercial" },
    publishing: { status },
    products: { primary: productIds.map((pid) => ({ productId: pid })) },
  } as ArticleV1;
}

const now = new Date("2026-08-19T12:00:00.000Z");
const today = getCanonicalDateString(now);

console.log("=== Canonical date ===");
assert(getCanonicalDateString(now) === "2026-08-19", "UTC YYYY-MM-DD format");

console.log("=== Detail URL suggestion ===");
const searchWithAsin = product({
  id: "swa",
  name: "SWA",
  category: "chairs",
  commerce: {
    asin: "B012345678",
    amazonUrl: "https://www.amazon.com/s?k=chair",
  },
});
assert(
  suggestAmazonDetailUrl(searchWithAsin.commerce!.asin, searchWithAsin.commerce!.amazonUrl) ===
    "https://www.amazon.com/dp/B012345678",
  "ASIN + search URL → detail suggestion",
);
assert(hasDetailUrlSuggestion(searchWithAsin.commerce!.asin, searchWithAsin.commerce!.amazonUrl), "has suggestion flag");

const detailProduct = product({
  id: "det",
  name: "Detail",
  category: "chairs",
  commerce: {
    asin: "B012345678",
    amazonUrl: "https://www.amazon.com/dp/B012345678",
  },
});
assert(
  suggestAmazonDetailUrl(detailProduct.commerce!.asin, detailProduct.commerce!.amazonUrl) === null,
  "existing detail URL → no suggestion",
);

const searchNoAsin = product({
  id: "sna",
  name: "SNA",
  category: "chairs",
  commerce: { amazonUrl: "https://www.amazon.com/s?k=chair" },
});
assert(
  suggestAmazonDetailUrl(searchNoAsin.commerce!.asin, searchNoAsin.commerce!.amazonUrl) === null,
  "search URL without ASIN → no suggestion",
);

console.log("=== ASIN mismatch ===");
const mismatch = product({
  id: "mm",
  name: "Mismatch",
  category: "chairs",
  commerce: {
    asin: "B000000001",
    amazonUrl: "https://amazon.com/dp/B000000002",
    lastChecked: "2026-01-01",
  },
});
const queueMismatch = buildProductMaintenanceQueue({ products: [mismatch], articles: [], now });
assert(
  Boolean(queueMismatch.candidates[0]?.reasons.some((r) => r.type === "asin-url-mismatch")),
  "ASIN/detail URL mismatch detected",
);

console.log("=== Mark checked local / resolution ===");
const neverChecked = product({
  id: "nc",
  name: "Never",
  category: "desks",
  commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678" },
});
const queueBefore = buildProductMaintenanceQueue({ products: [neverChecked], articles: [], now });
assert(
  Boolean(queueBefore.candidates[0]?.reasons.some((r) => r.type === "commerce-never-checked")),
  "never checked before mark",
);

const markedLocal = {
  ...neverChecked,
  commerce: { ...neverChecked.commerce, lastChecked: today },
};
assert(markedLocal.commerce!.lastChecked === today, "mark checked sets local lastChecked only");
assert(
  neverChecked.commerce!.lastChecked === undefined,
  "original fixture unchanged (no write)",
);

const queueAfter = buildProductMaintenanceQueue({ products: [markedLocal], articles: [], now });
assert(
  !queueAfter.candidates.some((c) => c.reasons.some((r) => r.type === "commerce-never-checked")),
  "never-checked signal removed after lastChecked set",
);

const staleProd = product({
  id: "stale",
  name: "Stale",
  category: "accessories",
  commerce: {
    amazonUrl: "https://amazon.com/dp/B012345678",
    asin: "B012345678",
    lastChecked: "2026-01-01",
  },
});
const queueStale = buildProductMaintenanceQueue({ products: [staleProd], articles: [], now });
assert(
  Boolean(queueStale.candidates[0]?.reasons.some((r) => r.type === "commerce-stale")),
  "stale before refresh",
);
const refreshed = {
  ...staleProd,
  commerce: { ...staleProd.commerce, lastChecked: today },
};
const queueFresh = buildProductMaintenanceQueue({ products: [refreshed], articles: [], now });
assert(
  !queueFresh.candidates.some((c) => c.reasons.some((r) => r.type === "commerce-stale")),
  "stale removed after mark checked today",
);

console.log("=== Material change classification ===");
const prev = product({
  id: "mat",
  name: "Mat",
  category: "chairs",
  commerce: { amazonUrl: "https://a.com/1", asin: "A", availability: "active", priceRange: "$1" },
  review: { rating: 4.5 },
  editorial: { verdict: "Old", bestFor: ["a"], notFor: ["b"] },
  media: { primary: "/old.jpg" },
  specs: { weightLb: 10 },
});
const curr = product({
  id: "mat",
  name: "Mat",
  category: "chairs",
  commerce: { amazonUrl: "https://a.com/2", asin: "A", availability: "active", priceRange: "$1" },
  review: { rating: 4.7 },
  editorial: { verdict: "New", bestFor: ["a"], notFor: ["b"] },
  media: { primary: "/old.jpg" },
  specs: { weightLb: 10 },
});
const changes = getProductMaterialChanges(prev, curr);
assert(changes.some((c) => c.category === "commerce" && c.fields.includes("commerce.amazonUrl")), "amazonUrl → commerce");
assert(changes.some((c) => c.category === "review"), "rating → review");
assert(changes.some((c) => c.category === "editorial" && c.fields.includes("editorial.verdict")), "verdict → editorial");

const availChange = getProductMaterialChanges(
  { ...prev, commerce: { ...prev.commerce, availability: "active" } },
  { ...prev, commerce: { ...prev.commerce, availability: "unknown" } },
);
assert(availChange.some((c) => c.category === "commerce" && c.fields.includes("commerce.availability")), "availability → commerce");

const specChange = getProductMaterialChanges(prev, { ...prev, specs: { weightLb: 12 } });
assert(specChange.some((c) => c.category === "specs"), "spec change → specs");

const mediaChange = getProductMaterialChanges(prev, { ...prev, media: { primary: "/new.jpg" } });
assert(mediaChange.some((c) => c.category === "media"), "media.primary → media");

const noop = getProductMaterialChanges(prev, prev);
assert(!hasProductMaterialChanges(noop), "identical snapshots → no material change");

const lastCheckedOnly = getProductMaterialChanges(
  { ...prev, commerce: { ...prev.commerce, lastChecked: "2026-01-01" } },
  { ...prev, commerce: { ...prev.commerce, lastChecked: "2026-08-19" } },
);
assert(!hasProductMaterialChanges(lastCheckedOnly), "lastChecked-only change is not material");

console.log("=== Article impact ===");
const impactProduct = product({
  id: "impact",
  name: "Impact",
  category: "chairs",
  commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678" },
  review: { rating: 4 },
});
const articles = [
  article("bl1", "best-chairs", "Best Chairs", ["impact"], "best-list"),
  article("rv1", "branch-review", "Branch Review", ["impact"], "review"),
  article("cp1", "compare", "Compare", ["impact"], "comparison"),
  article("dr1", "draft", "Draft", ["impact"], "guide", "draft"),
];
const ctx = buildProductMaterialChangeContext({
  productId: "impact",
  current: { ...impactProduct, review: { rating: 4.5 } },
  previousSnapshot: impactProduct,
  revisionMeta: { createdAt: "2026-08-18T00:00:00.000Z", createdBy: "admin@test.com", revisionNumber: 1 },
  articles,
});
assert(ctx.available, "material context available with revision");
assert(flattenMaterialChangeFields(ctx.materialChanges).includes("review.rating"), "material fields include rating");
assert(ctx.publishedArticles.length === 3, "published articles identified");
assert(ctx.reviewArticles.length === 1, "review article identified");
assert(ctx.bestListArticles.length === 1, "best list identified");
assert(ctx.comparisonArticles.length === 1, "comparison identified");
assert(ctx.dependencies.publishedRefs === 3, "published ref count");

console.log("=== URL classification ===");
assert(classifyAmazonUrlType("https://amazon.com/s?k=x") === "search", "search URL type");
assert(classifyAmazonUrlType("https://amazon.com/dp/B012345678") === "detail", "detail URL type");

console.log("=== No-write suggestion ===");
const beforeJson = JSON.stringify(searchWithAsin);
suggestAmazonDetailUrl(searchWithAsin.commerce!.asin, searchWithAsin.commerce!.amazonUrl);
buildProductMaintenanceQueue({ products: [searchWithAsin], articles: [], now });
assert(JSON.stringify(searchWithAsin) === beforeJson, "suggestion analysis does not mutate product");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("Commerce verification validation passed.");
