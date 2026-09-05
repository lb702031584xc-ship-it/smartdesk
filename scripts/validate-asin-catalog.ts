/**
 * ASIN catalog audit — read-only, no mutations.
 * Usage: npx tsx scripts/validate-asin-catalog.ts
 */
import { listProductsV1 } from "../src/lib/content/products";
import { classifyAsinStatus } from "../src/lib/commerce/asin";
import { isAmazonSearchUrl } from "../src/lib/admin/editorial-signals";

async function main() {
  const products = await listProductsV1();
  let valid = 0;
  let invalid = 0;
  let placeholder = 0;
  let missing = 0;
  let searchValidAsin = 0;
  let searchInvalidAsin = 0;
  let searchPlaceholderAsin = 0;
  let searchNoAsin = 0;

  const details: Array<{ id: string; name: string; asin?: string; status: string }> = [];

  for (const product of products) {
    const asin = product.commerce?.asin;
    const url = product.commerce?.amazonUrl;
    const status = classifyAsinStatus(asin);

    if (status === "missing") missing++;
    else if (status === "valid") valid++;
    else if (status === "placeholder") placeholder++;
    else invalid++;

    details.push({
      id: product.id,
      name: product.identity.name,
      asin: asin?.trim(),
      status,
    });

    if (isAmazonSearchUrl(url)) {
      if (status === "missing") searchNoAsin++;
      else if (status === "valid") searchValidAsin++;
      else if (status === "placeholder") searchPlaceholderAsin++;
      else searchInvalidAsin++;
    }
  }

  console.log("=== ASIN Catalog Audit ===");
  console.log(`Total products: ${products.length}`);
  console.log(`Valid ASIN: ${valid}`);
  console.log(`Invalid ASIN: ${invalid}`);
  console.log(`Placeholder ASIN: ${placeholder}`);
  console.log(`Missing ASIN: ${missing}`);
  console.log(`Search URL + valid ASIN: ${searchValidAsin}`);
  console.log(`Search URL + invalid ASIN: ${searchInvalidAsin}`);
  console.log(`Search URL + placeholder ASIN: ${searchPlaceholderAsin}`);
  console.log(`Search URL + no ASIN: ${searchNoAsin}`);
  console.log("\nDetails:");
  for (const row of details) {
    console.log(`  ${row.id}: ${row.status}${row.asin ? ` (${row.asin})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
