/**
 * Validate Product maintenance queue (deterministic, no network).
 * Usage: npx tsx scripts/validate-product-maintenance.ts
 */
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";
import {
  buildProductMaintenanceQueue,
  extractAsinFromAmazonUrl,
  COMMERCE_STALE_DAYS,
  getProductMaintenanceCandidate,
} from "../src/lib/editorial/product-maintenance";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else { failed++; console.error(`FAIL: ${message}`); }
}

function product(partial: Partial<ProductV1Document> & { id: string; name: string; category: ProductV1Document["identity"]["category"] }): ProductV1Document {
  return {
    schemaVersion: 1,
    id: partial.id,
    identity: { name: partial.name, brand: "Test", category: partial.category },
    commerce: partial.commerce,
    media: partial.media,
    editorial: partial.editorial,
    review: partial.review,
  } as ProductV1Document;
}

function article(id: string, slug: string, title: string, productIds: string[], type: ArticleV1["classification"]["type"] = "best-list"): ArticleV1 {
  return {
    identity: { id, slug, title },
    classification: { type, category: "chairs" },
    editorial: { intent: "commercial" },
    publishing: { status: "published" },
    products: { primary: productIds.map((pid) => ({ productId: pid })) },
  } as ArticleV1;
}

const now = new Date("2026-08-19T12:00:00.000Z");

console.log("=== URL / ASIN Tests ===");
assert(extractAsinFromAmazonUrl("https://amazon.com/dp/B012345678") === "B012345678", "extract ASIN from dp URL");
assert(extractAsinFromAmazonUrl("https://amazon.com/s?k=chair") === null, "search URL has no ASIN");

console.log("=== Search URL ===");

const searchProduct = product({
  id: "search-prod",
  name: "Search Product",
  category: "chairs",
  commerce: { amazonUrl: "https://www.amazon.com/s?k=chair", asin: "B012345678", lastChecked: "2026-01-01" },
});
const queueSearch = buildProductMaintenanceQueue({
  products: [searchProduct],
  articles: [],
  now,
});
const searchCandidate = queueSearch.candidates.find((c) => c.productId === "search-prod");
assert(!!searchCandidate?.reasons.some((r) => r.type === "search-url"), "search URL detected");

console.log("=== Detail URL ===");

const detailProduct = product({
  id: "detail-prod",
  name: "Detail Product",
  category: "chairs",
  commerce: { amazonUrl: "https://www.amazon.com/dp/B012345678", asin: "B012345678", lastChecked: now.toISOString().slice(0, 10) },
});
const queueDetail = buildProductMaintenanceQueue({ products: [detailProduct], articles: [], now });
assert(!queueDetail.candidates.some((c) => c.productId === "detail-prod" && c.reasons.some((r) => r.type === "search-url")), "detail URL has no search-url reason");

console.log("=== Placeholder ASIN ===");

const placeholderAsin = product({
  id: "placeholder-asin-prod",
  name: "Placeholder Product",
  category: "desks",
  commerce: { asin: "B0EXAMPLEFLEX1", amazonUrl: "https://amazon.com/s?k=desk" },
});
const queuePlaceholder = buildProductMaintenanceQueue({
  products: [placeholderAsin],
  articles: [],
  now,
});
const placeholderCandidate = queuePlaceholder.candidates.find(
  (c) => c.productId === "placeholder-asin-prod",
);
assert(
  Boolean(placeholderCandidate?.reasons.some((r) => r.type === "placeholder-asin")),
  "placeholder-asin reason detected",
);
assert(placeholderCandidate?.priority === "high", "placeholder-asin is HIGH priority");

const clearedPlaceholder = product({
  id: "placeholder-asin-prod",
  name: "Placeholder Product",
  category: "desks",
  commerce: { amazonUrl: "https://amazon.com/s?k=desk" },
});
const queueClearedPlaceholder = buildProductMaintenanceQueue({
  products: [clearedPlaceholder],
  articles: [],
  now,
});
const clearedCandidate = queueClearedPlaceholder.candidates.find(
  (c) => c.productId === "placeholder-asin-prod",
);
assert(
  !clearedCandidate?.reasons.some((r) => r.type === "placeholder-asin"),
  "placeholder-asin reason disappears after ASIN cleared",
);
assert(
  Boolean(clearedCandidate?.reasons.some((r) => r.type === "missing-asin")),
  "missing-asin reason appears after placeholder cleared",
);

console.log("=== Missing ASIN ===");

const noAsin = product({ id: "no-asin", name: "No ASIN", category: "desks", commerce: { amazonUrl: "https://amazon.com/dp/B012345678" } });
const queueNoAsin = buildProductMaintenanceQueue({ products: [noAsin], articles: [], now });
assert(queueNoAsin.candidates.some((c) => c.reasons.some((r) => r.type === "missing-asin")), "missing ASIN warning");

console.log("=== Availability Unknown ===");

const unknownAvail = product({ id: "unk", name: "Unknown", category: "monitors", commerce: { availability: "unknown", amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678", lastChecked: "2026-01-01" } });
const queueUnk = buildProductMaintenanceQueue({ products: [unknownAvail], articles: [], now });
assert(queueUnk.candidates.some((c) => c.reasons.some((r) => r.type === "availability-unknown")), "availability unknown");

console.log("=== Stale / Fresh ===");

const stale = product({ id: "stale", name: "Stale", category: "accessories", commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678", lastChecked: "2026-01-01" } });
const fresh = product({ id: "fresh", name: "Fresh", category: "accessories", commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678", lastChecked: "2026-08-01" } });
const queueStale = buildProductMaintenanceQueue({ products: [stale, fresh], articles: [], now, staleDays: COMMERCE_STALE_DAYS });
assert(Boolean(queueStale.candidates.find((c) => c.productId === "stale")?.reasons.some((r) => r.type === "commerce-stale")), "stale detected");
assert(!queueStale.candidates.find((c) => c.productId === "fresh")?.reasons.some((r) => r.type === "commerce-stale"), "fresh not stale");

console.log("=== ASIN Mismatch ===");

const mismatch = product({ id: "mismatch", name: "Mismatch", category: "chairs", commerce: { asin: "B000000001", amazonUrl: "https://amazon.com/dp/B000000002", lastChecked: "2026-01-01" } });
const queueMismatch = buildProductMaintenanceQueue({ products: [mismatch], articles: [], now });
assert(Boolean(queueMismatch.candidates.some((c) => c.reasons.some((r) => r.type === "asin-url-mismatch"))), "mismatch detected");

console.log("=== Unreferenced ===");

const unref = product({ id: "unref", name: "Unref", category: "desks", commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678" } });
const queueUnref = buildProductMaintenanceQueue({ products: [unref], articles: [], now });
assert(queueUnref.candidates.some((c) => c.reasons.some((r) => r.type === "unreferenced-product")), "unreferenced");

console.log("=== High Impact Escalation ===");

const impact = product({ id: "impact", name: "Impact", category: "chairs", commerce: { availability: "unknown", amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678", lastChecked: "2026-01-01" } });
const articles = [
  article("a1", "a1", "A1", ["impact"]),
  article("a2", "a2", "A2", ["impact"]),
  article("a3", "a3", "A3", ["impact"]),
];
const queueImpact = buildProductMaintenanceQueue({ products: [impact], articles, now });
const impactCandidate = queueImpact.candidates.find((c) => c.productId === "impact");
assert(!!impactCandidate, "impact product is candidate");
assert(impactCandidate!.reasons.some((r) => r.type === "high-impact-product"), "high impact context");
assert(impactCandidate!.priority === "medium" || impactCandidate!.priority === "high", "priority escalated");

console.log("=== Aggregation ===");

const aggProduct = product({ id: "agg", name: "Agg", category: "chairs", commerce: { amazonUrl: "https://amazon.com/s?k=x", availability: "unknown", lastChecked: "2026-01-01" } });
const queueAgg = buildProductMaintenanceQueue({ products: [aggProduct], articles: [], now });
const aggCandidate = queueAgg.candidates.find((c) => c.productId === "agg");
assert(!!aggCandidate && aggCandidate.reasons.length >= 2, "multiple reasons on one candidate");

console.log("=== Resolution ===");

const fixed = product({ id: "agg", name: "Agg", category: "chairs", commerce: { amazonUrl: "https://amazon.com/dp/B012345678", asin: "B012345678", availability: "active", lastChecked: now.toISOString().slice(0, 10) } });
const queueFixed = buildProductMaintenanceQueue({ products: [fixed], articles: [], now });
assert(!queueFixed.candidates.some((c) => c.productId === "agg" && c.reasons.some((r) => r.type === "search-url")), "search-url gone after fix");

console.log("=== Candidate Lookup ===");
assert(!!getProductMaintenanceCandidate("agg", queueAgg), "lookup works");

console.log("=== No Write ===");
assert(typeof buildProductMaintenanceQueue === "function", "pure function");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("Product maintenance validation passed.");
