/**
 * Placeholder detection, save/create guards, catalog classification tests.
 * Usage: npx tsx scripts/validate-catalog-commerce-guards.ts
 */
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { validateAdminProductCreate, validateAdminProductSave } from "../src/lib/admin/validate-save";
import { productLocalHints } from "../src/lib/admin/local-hints";
import {
  classifyAsinStatus,
  isObviousPlaceholderAsin,
  normalizeAsin,
  validateAsinForProductSave,
} from "../src/lib/commerce/asin";
import { suggestAmazonDetailUrl } from "../src/lib/editorial/commerce-verification";
import { getProductMaterialChanges, hasProductMaterialChanges } from "../src/lib/editorial/product-material-change";
import {
  auditProductCommerce,
  summarizeCatalogCommerceAudit,
} from "../src/lib/commerce/catalog-audit";
import type { ProductV1Document } from "../src/types/product-v1";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

console.log("=== Placeholder detection ===");
assert(isObviousPlaceholderAsin("B0EXAMPLEFLEX1"), "B0EXAMPLEFLEX1 placeholder");
assert(classifyAsinStatus("B0EXAMPLEFLEX1") === "placeholder", "classify placeholder");
assert(classifyAsinStatus("B0EXAMPLEBRANCH1") === "placeholder", "classify branch placeholder");
const normalizedTrim = normalizeAsin("  b0abc12345 ");
assert(normalizedTrim.ok, "normalize valid with trim");
if (normalizedTrim.ok) {
  assert(normalizedTrim.asin === "B0ABC12345", "uppercase valid");
}
assert(classifyAsinStatus("") === "missing", "empty missing");
assert(classifyAsinStatus(undefined) === "missing", "undefined missing");
assert(classifyAsinStatus("B01234567!") === "invalid", "non-alphanumeric invalid");
assert(!isObviousPlaceholderAsin("B07BDFW1Y7"), "real-looking ASIN not placeholder");

console.log("=== Save guards ===");
assert(Boolean(validateAsinForProductSave("B0EXAMPLEFLEX1")), "placeholder save rejected");
assert(!validateAsinForProductSave(undefined), "missing allowed");
assert(!validateAsinForProductSave(""), "blank allowed");
assert(!validateAsinForProductSave("B07BDFW1Y7"), "valid allowed");

const placeholderProduct = {
  ...blankProductV1(),
  id: "test-placeholder",
  identity: { ...blankProductV1().identity, name: "Test", category: "chairs" as const },
  commerce: { asin: "B0EXAMPLETEST1", amazonUrl: "https://amazon.com/s?k=x" },
} as ProductV1Document;

const saveResult = validateAdminProductSave(placeholderProduct);
assert(!saveResult.ok, "admin save rejects placeholder");

async function runAsyncTests() {
  const createResult = await validateAdminProductCreate({
    ...placeholderProduct,
    id: "new-placeholder-product",
  });
  assert(!createResult.ok, "admin create rejects placeholder");
}

console.log("=== Detail URL suggestion ===");
assert(
  suggestAmazonDetailUrl("B0EXAMPLEFLEX1", "https://amazon.com/s?k=x") === null,
  "no detail suggestion for placeholder ASIN",
);
assert(
  suggestAmazonDetailUrl("B07BDFW1Y7", "https://amazon.com/s?k=x") !== null,
  "detail suggestion for valid ASIN + search URL",
);

console.log("=== Material change ===");
const before = { ...placeholderProduct };
const after = {
  ...placeholderProduct,
  commerce: { ...placeholderProduct.commerce, asin: undefined },
} as ProductV1Document;
const changes = getProductMaterialChanges(before, after);
assert(hasProductMaterialChanges(changes), "ASIN removal is material commerce change");
assert(changes.some((c) => c.category === "commerce"), "commerce category");

const hints = productLocalHints(placeholderProduct);
assert(hints.errors.some((e) => e.includes("placeholder")), "local hints error on placeholder");

console.log("=== Strict integrity gate (fixture) ===");
const fixtureAudit = summarizeCatalogCommerceAudit([
  auditProductCommerce(placeholderProduct, { publishedRefs: 0, totalRefs: 0 }),
]);
assert(fixtureAudit.integrity.placeholderAsinFail, "fixture placeholder fails integrity");
assert(fixtureAudit.integrity.invalidAsinFail === false, "fixture has no invalid ASIN");

const cleanFixture = summarizeCatalogCommerceAudit([
  auditProductCommerce(
    {
      ...blankProductV1(),
      id: "clean-fixture",
      identity: { ...blankProductV1().identity, name: "Clean", category: "chairs" },
      commerce: { asin: "B07BDFW1Y7", amazonUrl: "https://amazon.com/s?k=chair" },
    } as ProductV1Document,
    { publishedRefs: 0, totalRefs: 0 },
  ),
]);
assert(!cleanFixture.integrity.placeholderAsinFail, "valid fixture passes placeholder gate");
assert(!cleanFixture.integrity.invalidAsinFail, "valid fixture passes invalid gate");

async function main() {
  await runAsyncTests();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Catalog commerce guards validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
