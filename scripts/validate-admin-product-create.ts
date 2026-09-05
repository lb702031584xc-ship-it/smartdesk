/**
 * Product creation INSERT checks, including cleanup of a temporary fixture.
 */
import fs from "fs";
import path from "path";
import { createAdminProductAction } from "../src/lib/admin/actions";
import { validateAdminProductCreate } from "../src/lib/admin/validate-save";
import { validateProductIdFormat } from "../src/lib/admin/product-id";
import {
  createAdminProduct,
  deleteAdminProductRecord,
  getAdminProduct,
} from "../src/lib/admin/product-store";
import { listAdminArticles, listAdminProducts } from "../src/lib/admin";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { validateProductV1 } from "../src/lib/product-schema";
import type { ProductV1Document } from "../src/types/product-v1";

const TEST_ID = "zz-admin-create-test-product";

function fail(message: string): never {
  console.error(`[admin-product-create] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function testProduct(overrides: Partial<ProductV1Document> = {}): ProductV1Document {
  return {
    schemaVersion: 1,
    id: TEST_ID,
    identity: {
      name: "Admin Create Test Product",
      brand: "SmartDesk Test",
      category: "accessories",
    },
    ...overrides,
  };
}

async function cleanupTestProduct() {
  const existing = await getAdminProduct(TEST_ID);
  if (existing) {
    await deleteAdminProductRecord(TEST_ID);
  }
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required for Product create validation.");
  }

  await cleanupTestProduct();

  const productsBefore = await listAdminProducts();
  const articlesBefore = await listAdminArticles();
  assert(productsBefore.length === 13, `expected 13 products before create, got ${productsBefore.length}`);
  assert(articlesBefore.length === 12, `expected 12 articles, got ${articlesBefore.length}`);

  assert(validateProductIdFormat("") === "Product ID is required.", "empty ID should fail");
  assert(Boolean(validateProductIdFormat("Branch Chair")), "spaces should fail");
  assert(Boolean(validateProductIdFormat("Branch-Chair")), "uppercase should fail");
  assert(Boolean(validateProductIdFormat("new")), "reserved new id should fail");
  assert(validateProductIdFormat(TEST_ID) === undefined, "fixture id should be valid");

  const duplicate = await createAdminProduct({
    schemaVersion: 1,
    id: "flexispot-compact",
    identity: {
      name: "Should Not Overwrite",
      brand: "Nope",
      category: "desks",
    },
  });
  assert(!duplicate.ok, "duplicate Product ID must be rejected");
  assert(
    duplicate.errors.some((error) => error.toLowerCase().includes("already exists")),
    "duplicate error should be friendly",
  );
  const original = await getAdminProduct("flexispot-compact");
  assert(
    Boolean(original?.product.identity.name.includes("FlexiSpot")),
    "duplicate create must not overwrite the existing Product",
  );

  const invalid = await validateAdminProductCreate({
    schemaVersion: 1,
    id: TEST_ID,
    identity: { name: "", brand: "X", category: "desks" },
  });
  assert(!invalid.ok, "invalid Product must fail validation");

  const invalidInsert = await createAdminProduct({
    schemaVersion: 1,
    id: TEST_ID,
    identity: { name: "", brand: "X", category: "desks" },
  });
  assert(!invalidInsert.ok, "invalid Product must not insert");
  assert(!(await getAdminProduct(TEST_ID)), "invalid Product must stay absent");

  const unauthenticated = await createAdminProductAction(testProduct());
  assert(!unauthenticated.ok, "create action without admin session must fail");
  assert(
    unauthenticated.errors.some((error) => error.toLowerCase().includes("session")),
    "unauthenticated create should report session expiry",
  );
  assert(!(await getAdminProduct(TEST_ID)), "unauthenticated create must not insert");

  const created = await createAdminProduct(testProduct());
  assert(created.ok, `valid Product insert failed: ${created.errors.join("; ")}`);

  const loaded = await getAdminProduct(TEST_ID);
  assert(Boolean(loaded), "created Product must be retrievable");
  assert(loaded?.product.schemaVersion === 1, "created Product must be ProductV1");
  assert(loaded?.product.identity.name === "Admin Create Test Product", "name mismatch");
  assert(loaded?.product.review?.rating === undefined, "must not invent a rating");
  assert(loaded?.product.commerce?.asin === undefined, "must not invent an ASIN");
  assert(loaded?.product.commerce?.amazonUrl === undefined, "must not invent an amazonUrl");
  const structural = validateProductV1(loaded!.product);
  assert(structural.valid, `created Product failed ProductV1 validation: ${structural.errors.join("; ")}`);

  const listed = await listAdminProducts();
  assert(listed.some((item) => item.id === TEST_ID), "created Product must appear in Admin list");
  assert(listed.length === productsBefore.length + 1, "Admin list count should increase by 1");

  const snapshotPath = path.join(process.cwd(), "content/products", `${TEST_ID}.json`);
  assert(!fs.existsSync(snapshotPath), "create must not write repository JSON");

  const articlesDuring = await listAdminArticles();
  assert(articlesDuring.length === 12, "creating a Product must not change Article count");

  await deleteAdminProductRecord(TEST_ID);
  assert(!(await getAdminProduct(TEST_ID)), "cleanup must remove the test Product");

  const productsAfter = await listAdminProducts();
  const articlesAfter = await listAdminArticles();
  assert(productsAfter.length === productsBefore.length, "product count must be restored");
  assert(articlesAfter.length === 12, "article count must stay 12");
  assert(!productsAfter.some((item) => item.id === TEST_ID), "fixture must not remain in the list");

  console.log("[admin-product-create] Duplicate ID: PASS");
  console.log("[admin-product-create] Invalid Product: PASS");
  console.log("[admin-product-create] Auth-gated action: PASS");
  console.log("[admin-product-create] Valid Product insert: PASS");
  console.log("[admin-product-create] Cleanup: PASS");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await cleanupTestProduct().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
