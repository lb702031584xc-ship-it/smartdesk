/**
 * Product mutation boundary validation (Phase 34).
 * Usage: npm run validate:product-mutations
 *
 * Tests allowlisted editorial updates, forbidden fields, version conflicts,
 * revision creation, and article dependency path planning.
 */
import "./load-env-local";
import {
  applyEditorialChanges,
  updateProductEditorialFields,
  validateEditorialMutationChanges,
} from "../src/lib/product-mutations";
import {
  createAdminProduct,
  deleteAdminProductRecord,
  getAdminProduct,
} from "../src/lib/admin/product-store";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import {
  collectProductRevalidationPaths,
  findPublishedArticleSlugsReferencingProduct,
} from "../src/lib/admin/revalidate-content";
import { countProductRevisions, listProductRevisions } from "../src/lib/db/revisions";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ProductV1Document } from "../src/types/product-v1";

const TEST_ID = "zz-phase34-editorial-mutation";
const ACTOR = "phase34-mutation@smartdesksetup.com";

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

async function cleanup() {
  await deleteAdminProductRecord(TEST_ID).catch(() => undefined);
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: TEST_ID,
    identity: {
      name: "Phase 34 Mutation Fixture",
      brand: "SmartDesk Test",
      category: "accessories",
    },
    editorial: {
      role: "best-value",
      verdict: "Before verdict",
      bestFor: ["small desks"],
      notFor: ["large rooms"],
      description: "Must remain unchanged",
      featured: false,
    },
    commerce: {
      amazonUrl: "https://www.amazon.com/s?k=phase34-test",
      availability: "unknown",
    },
  };
}

async function main() {
  console.log("=== Pure: allowed / forbidden field validation ===");

  const okEditorial = validateEditorialMutationChanges({
    editorial: {
      role: "best-overall",
      verdict: "New verdict",
      bestFor: ["apartments"],
      notFor: ["warehouses"],
    },
  });
  assert(okEditorial.ok, "allowed editorial update validates");

  const forbiddenAsin = validateEditorialMutationChanges({
    editorial: { verdict: "x" },
    commerce: { asin: "B08NEVER" },
  });
  assert(!forbiddenAsin.ok, "forbidden ASIN / commerce update rejected");
  assert(
    !forbiddenAsin.ok && forbiddenAsin.error === "FIELD_NOT_EDITABLE",
    "ASIN rejection uses FIELD_NOT_EDITABLE",
  );

  const unknownTop = validateEditorialMutationChanges({
    identity: { brand: "Nope" },
  });
  assert(!unknownTop.ok && unknownTop.error === "FIELD_NOT_EDITABLE", "unknown top field fails");

  const unknownEditorial = validateEditorialMutationChanges({
    editorial: { featured: true },
  });
  assert(
    !unknownEditorial.ok && unknownEditorial.error === "FIELD_NOT_EDITABLE",
    "editorial.featured not Phase 34 editable",
  );

  const badRole = validateEditorialMutationChanges({
    editorial: { role: "not-a-role" },
  });
  assert(!badRole.ok && badRole.error === "INVALID_ENUM", "invalid role enum fails");

  const base = testProduct();
  const merged = applyEditorialChanges(base, {
    editorial: { verdict: "After verdict", role: "best-overall" },
  });
  assert(merged.editorial?.verdict === "After verdict", "merge updates verdict");
  assert(merged.editorial?.role === "best-overall", "merge updates role");
  assert(merged.editorial?.description === "Must remain unchanged", "merge preserves description");
  assert(
    merged.commerce?.amazonUrl === "https://www.amazon.com/s?k=phase34-test",
    "merge preserves amazonUrl",
  );
  assert(merged.identity.brand === "SmartDesk Test", "merge preserves brand");

  console.log("=== Dependency revalidation planning ===");
  const branchSlugs = await findPublishedArticleSlugsReferencingProduct(
    "branch-ergonomic-chair",
  );
  assert(branchSlugs.length > 0, "branch-ergonomic-chair has published article deps");
  const planned = collectProductRevalidationPaths({
    articleSlugs: branchSlugs,
    category: "chairs",
  });
  assert(
    planned.some((p) => p.startsWith("/blog/")),
    "product mutation dependency paths include article routes",
  );

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration writes: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("Product mutations validation passed (pure + dependency planning).");
    return;
  }

  console.log("=== Integration: mutation write path ===");
  await cleanup();

  const created = await createAdminProduct(testProduct());
  assert(created.ok, "fixture product create");
  const before = await getAdminProduct(TEST_ID);
  assert(Boolean(before), "fixture product loaded");
  assert((await countProductRevisions(TEST_ID)) === 0, "no revisions on create");

  const missing = await updateProductEditorialFields({
    productId: "does-not-exist-phase34",
    changes: { editorial: { verdict: "x" } },
    expectedVersion: 1,
    actor: ACTOR,
  });
  assert(!missing.success && missing.error === "PRODUCT_NOT_FOUND", "missing product fails");

  const forbiddenWrite = await updateProductEditorialFields({
    productId: TEST_ID,
    changes: {
      editorial: { verdict: "should not apply" },
      commerce: { asin: "B08HACKED" },
    },
    expectedVersion: before!.version ?? 1,
    actor: ACTOR,
  });
  assert(
    !forbiddenWrite.success && forbiddenWrite.error === "FIELD_NOT_EDITABLE",
    "forbidden ASIN update fails before write",
  );
  const afterForbidden = await getAdminProduct(TEST_ID);
  assert(
    afterForbidden?.product.commerce?.amazonUrl ===
      "https://www.amazon.com/s?k=phase34-test",
    "commerce unchanged after forbidden attempt",
  );

  const stale = await updateProductEditorialFields({
    productId: TEST_ID,
    changes: { editorial: { verdict: "stale attempt" } },
    expectedVersion: (before!.version ?? 1) - 1,
    actor: ACTOR,
  });
  assert(!stale.success && stale.error === "VERSION_CONFLICT", "stale version fails");

  const ok = await updateProductEditorialFields({
    productId: TEST_ID,
    changes: {
      editorial: {
        role: "best-overall",
        verdict: "After controlled mutation",
        bestFor: ["tiny offices"],
        notFor: ["open floors"],
      },
    },
    expectedVersion: before!.version ?? 1,
    actor: ACTOR,
  });
  assert(ok.success, "valid editorial update succeeds");
  if (ok.success) {
    assert(ok.revisionCreated, "revision created on editorial change");
    assert(typeof ok.revisionId === "string" && ok.revisionId.length > 0, "revisionId returned");
    assert(ok.updatedProduct.editorial?.verdict === "After controlled mutation", "verdict saved");
    assert(ok.updatedProduct.editorial?.role === "best-overall", "role saved");
    assert(ok.updatedProduct.editorial?.description === "Must remain unchanged", "description intact");
    assert(
      ok.updatedProduct.commerce?.amazonUrl ===
        "https://www.amazon.com/s?k=phase34-test",
      "commerce intact after save",
    );
    assert(Array.isArray(ok.dependencyPaths), "dependencyPaths present on success");
  }

  const revisions = await listProductRevisions(TEST_ID);
  assert(revisions.length === 1, "one revision after mutation");
  assert(revisions[0]!.createdBy === ACTOR, "actor recorded on revision");
  assert(
    revisions[0]!.data.editorial?.verdict === "Before verdict",
    "revision snapshot preserves previous editorial",
  );

  await cleanup();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Product mutations validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
