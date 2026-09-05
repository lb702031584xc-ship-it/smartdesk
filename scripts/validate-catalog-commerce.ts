/**
 * Catalog commerce integrity audit — read-only.
 * Usage: npx tsx scripts/validate-catalog-commerce.ts
 */
import "./load-env-local";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { buildProductDependencies } from "../src/lib/editorial/product-maintenance";
import {
  auditProductCommerce,
  catalogCommerceTriageOrder,
  summarizeCatalogCommerceAudit,
} from "../src/lib/commerce/catalog-audit";
import { getAmazonPaapiConfig, isAmazonPaapiConfigured } from "../src/lib/commerce/config";
import { lookupAmazonByAsin } from "../src/lib/commerce/amazon-paapi";

async function main() {
  const products = await listProductsV1();
  const articles = await listArticlesV1();
  const deps = buildProductDependencies(products, articles);

  const rows = products
    .map((product) =>
      auditProductCommerce(product, {
        publishedRefs: deps.get(product.id)?.publishedRefs ?? 0,
        totalRefs: deps.get(product.id)?.totalRefs ?? 0,
      }),
    )
    .sort((a, b) => catalogCommerceTriageOrder(a) - catalogCommerceTriageOrder(b));

  const audit = summarizeCatalogCommerceAudit(rows);

  console.log("=== Catalog Commerce Audit ===");
  console.log(`Products: ${audit.productCount}`);
  console.log(`Valid ASIN: ${audit.validAsin}`);
  console.log(`Invalid ASIN: ${audit.invalidAsin}`);
  console.log(`Placeholder ASIN: ${audit.placeholderAsin}`);
  console.log(`Missing ASIN: ${audit.missingAsin}`);
  console.log(`Search URLs: ${audit.searchUrls}`);
  console.log(`Detail URLs: ${audit.detailUrls}`);
  console.log(`ASIN/URL mismatches: ${audit.asinUrlMismatches}`);
  console.log(`Search URL + valid ASIN: ${audit.searchUrlValidAsin}`);
  console.log(`Search URL + invalid ASIN: ${audit.searchUrlInvalidAsin}`);
  console.log(`Search URL + placeholder ASIN: ${audit.searchUrlPlaceholderAsin}`);
  console.log(`Search URL + missing ASIN: ${audit.searchUrlMissingAsin}`);
  console.log(`Ready for Amazon lookup: ${audit.readyForAmazonLookup}`);

  console.log("\n=== Product Details (triage order) ===");
  for (const row of audit.products) {
    console.log(
      `${row.productId}: asin=${row.asinStatus} url=${row.urlType} refs=${row.publishedRefs}/${row.totalRefs}${row.asinUrlMismatch ? " MISMATCH" : ""}${row.storedAsin ? ` (${row.storedAsin})` : ""}`,
    );
  }

  console.log("\n=== Integrity Policy ===");
  if (audit.integrity.placeholderAsinFail) {
    console.log("FAIL: placeholder ASIN present in catalog — manual verification required.");
  } else {
    console.log("PASS: no placeholder ASIN.");
  }
  if (audit.integrity.invalidAsinFail) {
    console.log("FAIL: invalid non-placeholder ASIN present in catalog.");
  } else {
    console.log("PASS: no invalid non-placeholder ASIN.");
  }
  if (audit.integrity.asinMismatchFail) {
    console.log("FAIL: ASIN/detail URL mismatch present.");
  } else {
    console.log("PASS: no ASIN/detail URL mismatch.");
  }

  console.log("\n=== Live PAAPI Smoke Test ===");
  if (!isAmazonPaapiConfigured()) {
    console.log("LIVE PAAPI TEST: NOT EXECUTED (credentials not configured)");
  } else {
    const config = getAmazonPaapiConfig()!;
    const smokeAsin = process.env.PAAPI_SMOKE_ASIN?.trim() || "B0CTJF8T2G";
    console.log(`Testing GetItems for ASIN ${smokeAsin}…`);
    const result = await lookupAmazonByAsin(config, smokeAsin, { bypassCache: true });
    if (result.ok) {
      console.log("LIVE PAAPI ACCESS: OK");
      console.log(`Title: ${result.suggestion.sourceTitle ?? "—"}`);
      console.log(`URL: ${result.suggestion.amazonUrl ?? "—"}`);
    } else {
      console.log(`LIVE PAAPI ACCESS: ${result.code === "permission_denied" ? "BLOCKED" : "FAILED"}`);
      console.log(`Reason: ${result.message}`);
    }
  }

  if (
    audit.integrity.placeholderAsinFail ||
    audit.integrity.invalidAsinFail ||
    audit.integrity.asinMismatchFail
  ) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
