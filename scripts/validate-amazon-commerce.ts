/**
 * Phase 24 — Amazon commerce assistant validation (mocked provider, no live PAAPI).
 * Usage: npx tsx scripts/validate-amazon-commerce.ts
 */
import type { ProductV1Document } from "../src/types/product-v1";
import { classifyAsinStatus, isObviousPlaceholderAsin, normalizeAsin } from "../src/lib/commerce/asin";
import {
  applyCommercePatchToProduct,
  buildApplyAllPatch,
  buildCommerceApplyPatch,
  getApplicableCommerceFields,
} from "../src/lib/commerce/apply";
import { stripAmazonAffiliateParams, normalizePaapiItem } from "../src/lib/commerce/normalize";
import {
  getCommerceProvider,
  setCommerceProviderForTests,
  type CommerceProvider,
} from "../src/lib/commerce/provider";
import { getProductMaterialChanges, hasProductMaterialChanges } from "../src/lib/editorial/product-material-change";
import { siteConfig } from "../src/lib/site";
import type { CommerceSuggestion } from "../src/lib/commerce/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

const mockSuggestion: CommerceSuggestion = {
  source: "amazon-paapi",
  fetchedAt: "2026-08-19T12:00:00.000Z",
  asin: "B012345678",
  amazonUrl: "https://www.amazon.com/dp/B012345678",
  availability: "active",
  externalPrice: "$169.00",
  primaryImage: "https://m.media-amazon.com/images/I/example.jpg",
  sourceTitle: "Example Product",
};

function mockProvider(overrides?: Partial<CommerceProvider>): CommerceProvider {
  return {
    status: () => ({ configured: true, source: "amazon-paapi", message: "mock" }),
    lookupByAsin: async (asin) => {
      const normalized = normalizeAsin(asin);
      if (!normalized.ok) {
        return { ok: false, code: "invalid_asin", message: normalized.message };
      }
      if (normalized.asin === "B000000000") {
        return { ok: false, code: "not_found", message: "No Amazon item found for this ASIN." };
      }
      return { ok: true, suggestion: { ...mockSuggestion, asin: normalized.asin } };
    },
    searchProducts: async () => ({
      ok: true,
      fetchedAt: "2026-08-19T12:00:00.000Z",
      items: [
        {
          asin: "B012345678",
          title: "Example Brand Chair",
          amazonUrl: "https://www.amazon.com/dp/B012345678",
          matchEvidence: ["Brand matches title"],
        },
      ],
    }),
    suggestionFromSearchItem: (item, fetchedAt) => ({
      source: "amazon-paapi",
      fetchedAt,
      asin: item.asin,
      amazonUrl: item.amazonUrl,
      sourceTitle: item.title,
    }),
    ...overrides,
  };
}

console.log("=== ASIN normalization ===");
const trimmed = normalizeAsin("  b012345678  ");
assert(trimmed.ok, "trim/uppercase");
if (trimmed.ok) assert(trimmed.asin === "B012345678", "normalized value");
assert(isObviousPlaceholderAsin("B0EXAMPLEFLEX1"), "placeholder pattern");
assert(classifyAsinStatus("B0EXAMPLEFLEX1") === "placeholder", "placeholder status");
assert(!normalizeAsin("B0EXAMPLEFLEX1").ok, "placeholder fails normalize");
assert(!normalizeAsin("B012").ok, "too short invalid");
assert(!normalizeAsin("B0123456789012").ok, "too long invalid");
assert(!normalizeAsin("B01234567!").ok, "invalid characters");
assert(!normalizeAsin(undefined).ok, "missing ASIN");

console.log("=== Affiliate URL strip ===");
const tagged = stripAmazonAffiliateParams(
  "https://www.amazon.com/dp/B012345678?tag=partner-20&linkCode=ogi",
);
assert(!tagged.includes("tag="), "strip affiliate tag from suggested URL");
assert(tagged.includes("/dp/B012345678"), "preserve detail path");

async function main() {
console.log("=== Provider lookup (mock) ===");
setCommerceProviderForTests(mockProvider());
const provider = getCommerceProvider();
const okLookup = await provider.lookupByAsin("B012345678");
assert(okLookup.ok, "valid ASIN lookup succeeds");
const notFound = await provider.lookupByAsin("B000000000");
assert(!notFound.ok && notFound.code === "not_found", "not found safe error");
const invalidLookup = await provider.lookupByAsin("BAD");
assert(!invalidLookup.ok && invalidLookup.code === "invalid_asin", "invalid ASIN blocked");

setCommerceProviderForTests(
  mockProvider({
    lookupByAsin: async () => ({
      ok: false,
      code: "not_configured",
      message: "Amazon lookup is not configured.",
    }),
  }),
);
const unconfigured = await getCommerceProvider().lookupByAsin("B012345678");
assert(!unconfigured.ok && unconfigured.code === "not_configured", "provider unavailable");

console.log("=== Mapping ===");
const fields = getApplicableCommerceFields(mockSuggestion);
assert(fields.includes("commerce.asin"), "maps ASIN");
assert(fields.includes("commerce.amazonUrl"), "maps URL");
assert(fields.includes("commerce.availability"), "maps availability");
assert(fields.includes("media.primary"), "maps image");
assert(!fields.some((f) => f.startsWith("review.")), "rating not mapped");
assert(!fields.some((f) => f.includes("priceRange")), "priceRange not mapped");

const paapiItem = normalizePaapiItem(
  {
    ASIN: "B012345678",
    DetailPageURL: "https://www.amazon.com/dp/B012345678?tag=x-20",
    ItemInfo: { Title: { DisplayValue: "Title" } },
    Offers: { Listings: [{ Availability: { Type: "Now" }, Price: { DisplayAmount: "$10" } }] },
  },
  "2026-08-19T12:00:00.000Z",
);
assert(Boolean(paapiItem?.asin), "PAAPI item normalized");
assert(Boolean(paapiItem?.amazonUrl && !paapiItem.amazonUrl.includes("tag=")), "untagged detail URL");

console.log("=== Apply local only ===");
const base: ProductV1Document = {
  schemaVersion: 1,
  id: "test",
  identity: { name: "Test", brand: "Brand", category: "chairs" },
  commerce: { amazonUrl: "https://amazon.com/s?k=x", availability: "unknown", lastChecked: "2026-01-01" },
} as ProductV1Document;
const before = JSON.stringify(base);
const patch = buildCommerceApplyPatch(mockSuggestion, ["commerce.asin", "commerce.amazonUrl"]);
const applied = applyCommercePatchToProduct(base, patch);
assert(applied.commerce?.asin === "B012345678", "apply ASIN local");
assert(Boolean(applied.commerce?.amazonUrl?.includes("/dp/")), "apply URL local");
assert(applied.commerce?.lastChecked === "2026-01-01", "apply does not touch lastChecked");
assert(JSON.stringify(base) === before, "original product unchanged");

const allPatch = buildApplyAllPatch(mockSuggestion);
const allApplied = applyCommercePatchToProduct(base, allPatch);
assert(allApplied.media?.primary === mockSuggestion.primaryImage, "apply all includes image");

console.log("=== Runtime affiliate ===");
const runtimeUrl = (() => {
  const parsed = new URL(applied.commerce!.amazonUrl!);
  parsed.searchParams.set("tag", siteConfig.affiliateTag);
  return parsed.toString();
})();
assert(runtimeUrl.includes(siteConfig.affiliateTag), "runtime affiliate tag applied");
assert(!applied.commerce!.amazonUrl!.includes("tag="), "stored URL remains untagged");

console.log("=== Material change after save scenario ===");
const prev = { ...base };
const saved = applyCommercePatchToProduct(base, allPatch);
const changes = getProductMaterialChanges(prev, saved);
assert(hasProductMaterialChanges(changes), "commerce/media changes detected");
assert(changes.some((c) => c.category === "commerce"), "commerce category");

console.log("=== Malformed provider ===");
setCommerceProviderForTests(
  mockProvider({
    lookupByAsin: async () => ({
      ok: false,
      code: "malformed_response",
      message: "Amazon API returned an unexpected response.",
    }),
  }),
);
const malformed = await getCommerceProvider().lookupByAsin("B012345678");
assert(!malformed.ok && malformed.code === "malformed_response", "malformed response rejected");

setCommerceProviderForTests(null);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("Amazon commerce validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
