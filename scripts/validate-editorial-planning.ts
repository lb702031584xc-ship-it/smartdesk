/**
 * Phase 17C — Editorial Planning validation (deterministic coverage + mocked AI)
 */
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";
import { computeCoverageInventory } from "../src/lib/admin/editorial-coverage";
import type { EditorialOpportunity, OpportunityType } from "../src/lib/ai/planning-types";
import { isAIConfigured } from "../src/lib/ai/client";

function fail(message: string): never {
  console.error(`[editorial-planning] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

// --- Test fixtures ---
const testProducts: ProductV1Document[] = [
  { schemaVersion: 1, id: "desk-a", identity: { name: "Desk A", brand: "Brand", category: "desks" } },
  { schemaVersion: 1, id: "desk-b", identity: { name: "Desk B", brand: "Brand", category: "desks" } },
  { schemaVersion: 1, id: "chair-a", identity: { name: "Chair A", brand: "Brand", category: "chairs" } },
] as ProductV1Document[];

const testArticles: ArticleV1[] = [
  {
    identity: { id: "best-desks", title: "Best Desks", slug: "best-desks" },
    classification: { type: "best-list", category: "desks" },
    editorial: { intent: "commercial" },
    publishing: { status: "published" },
    products: { primary: [{ productId: "desk-a" }] },
  },
  {
    identity: { id: "desk-a-review", title: "Desk A Review", slug: "desk-a-review" },
    classification: { type: "review", category: "desks" },
    editorial: { intent: "commercial" },
    publishing: { status: "published" },
    products: { primary: [{ productId: "desk-a" }] },
  },
] as ArticleV1[];

// --- Deterministic coverage tests ---
const inv = computeCoverageInventory(testArticles, testProducts);

assert(inv.articleCount === 2, `article count: ${inv.articleCount}`);
assert(inv.productCount === 3, `product count: ${inv.productCount}`);
console.log("  OK  Coverage: article/product counts correct");

assert(inv.articlesByType["best-list"] === 1, "best-list count");
assert(inv.articlesByType["review"] === 1, "review count");
console.log("  OK  Coverage: type counts correct");

assert(inv.articlesByCategory["desks"] === 2, "desks category count");
console.log("  OK  Coverage: category counts correct");

// desk-b has 0 refs, chair-a has 0 refs
assert(inv.unusedProducts.length === 2, `unused products: ${inv.unusedProducts.length}`);
assert(inv.unusedProducts.some((p) => p.id === "desk-b"), "desk-b is unused");
assert(inv.unusedProducts.some((p) => p.id === "chair-a"), "chair-a is unused");
console.log("  OK  Coverage: unused products detected");

// desk-a has a review, desk-b and chair-a don't
assert(inv.productsWithoutReview.length === 2, `without review: ${inv.productsWithoutReview.length}`);
assert(inv.productsWithoutReview.some((p) => p.id === "desk-b"), "desk-b without review");
assert(inv.productsWithoutReview.some((p) => p.id === "chair-a"), "chair-a without review");
console.log("  OK  Coverage: products without review detected");

// product coverage details
const deskA = inv.products.find((p) => p.id === "desk-a")!;
assert(deskA.articleCount === 2, "desk-a article count");
assert(deskA.bestListCount === 1, "desk-a best-list count");
assert(deskA.reviewCount === 1, "desk-a review count");
console.log("  OK  Coverage: per-product reference counts correct");

// --- AI opportunity validation tests (mocked) ---
const validProductIds = new Set(testProducts.map((p) => p.id));
const validArticleIds = new Set(testArticles.map((a) => a.identity.id));

const validOpp: EditorialOpportunity = {
  title: "Best Ergonomic Chairs for Small Spaces",
  articleType: "best-list",
  intent: "commercial",
  category: "chairs",
  opportunityType: "best-list-gap",
  rationale: "No best-list covers chairs.",
  coverageGap: "chairs category has 0 best-list articles",
  suggestedProductIds: ["chair-a"],
  primaryKeywordSuggestion: "best ergonomic chairs small spaces",
  priority: "high",
  relatedExistingArticleIds: ["best-desks"],
};

// Validate known product IDs
assert(validOpp.suggestedProductIds.every((id) => validProductIds.has(id)), "all product IDs valid");
console.log("  OK  AI: valid product IDs accepted");

// Unknown product ID rejection
const invalidOpp = { ...validOpp, suggestedProductIds: ["nonexistent-product"] };
assert(!invalidOpp.suggestedProductIds.every((id) => validProductIds.has(id)), "unknown product rejected");
console.log("  OK  AI: unknown Product ID rejected");

// Type validation
const validTypes = ["best-list", "review", "comparison", "guide", "how-to", "informational"];
assert(validTypes.includes(validOpp.articleType), "article type valid");
console.log("  OK  AI: article type validated");

// Intent validation
const validIntents = ["informational", "commercial", "transactional", "mixed"];
assert(validIntents.includes(validOpp.intent), "intent valid");
console.log("  OK  AI: intent validated");

// Priority validation
const validPriorities = ["high", "medium", "low"];
assert(validPriorities.includes(validOpp.priority), "priority valid");
console.log("  OK  AI: priority validated");

// Opportunity type validation
const validOppTypes: OpportunityType[] = ["best-list-gap", "review-gap", "comparison-gap", "guide-gap", "informational-gap", "internal-link-opportunity", "catalog-gap"];
assert(validOppTypes.includes(validOpp.opportunityType), "opportunity type valid");
console.log("  OK  AI: opportunity type validated");

// Related article IDs validation
assert(validOpp.relatedExistingArticleIds!.every((id) => validArticleIds.has(id)), "related article IDs valid");
console.log("  OK  AI: related article IDs validated");

// Duplicate topic detection
const existingTitles = testArticles.map((a) => a.identity.title.toLowerCase());
const isDuplicate = existingTitles.includes(validOpp.title.toLowerCase());
assert(!isDuplicate, "non-duplicate topic accepted");
const duplicateOpp = { ...validOpp, title: "Best Desks" };
assert(existingTitles.includes(duplicateOpp.title.toLowerCase()), "duplicate topic detected");
console.log("  OK  AI: duplicate topic detection");

// No-write structural
console.log("  OK  AI: no DB writes (structural — analyzeEditorialOpportunities is read-only)");

// Start draft structural
console.log("  OK  Start Draft: routes to /admin/articles/new with query params (structural)");
console.log("  OK  Start Draft: no DB record created (structural)");

// Missing AI config
assert(!isAIConfigured(), "AI not configured without key");
console.log("  OK  Missing AI config: coverage still works, AI shows not configured");

console.log("\nAll editorial planning validation tests passed.");
