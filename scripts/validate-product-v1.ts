/**
 * Product Schema V1 checks for production product JSON files.
 *
 * Run: npm run validate:product-v1
 */
import fs from "fs";
import path from "path";
import {
  isProductV1Document,
  mapProductV1CategoryToLegacy,
  productV1ToLegacyProduct,
  validateProductV1,
} from "../src/lib/product-schema";
import { clearProductCache, getProductByIdSync } from "../src/lib/products";

function fail(message: string): never {
  console.error(`[product-v1] ${message}`);
  process.exit(1);
}

const productsDir = path.join(process.cwd(), "content/products");
const files = fs
  .readdirSync(productsDir)
  .filter((fileName) => fileName.endsWith(".json"));

const allIds = new Set<string>();
let v1Count = 0;

for (const fileName of files) {
  const fullPath = path.join(productsDir, fileName);
  const parsed: unknown = JSON.parse(fs.readFileSync(fullPath, "utf8"));

  if (!isProductV1Document(parsed)) {
    fail(
      `${fileName} is not Product V1 (production catalog requires schemaVersion: 1).`,
    );
  }

  v1Count += 1;
  const result = validateProductV1(parsed);
  if (!result.valid) {
    fail(
      `${fileName} failed validation:\n- ${result.errors.join("\n- ")}`,
    );
  }
  for (const warning of result.warnings) {
    console.warn(`[product-v1] ${fileName}: ${warning}`);
  }

  if (allIds.has(parsed.id)) {
    fail(`Duplicate product id across files: "${parsed.id}"`);
  }
  allIds.add(parsed.id);

  const legacy = productV1ToLegacyProduct(parsed);
  const required: Array<keyof typeof legacy> = [
    "id",
    "name",
    "brand",
    "category",
    "image",
    "rating",
    "priceRange",
    "pros",
    "cons",
    "amazonUrl",
  ];
  for (const key of required) {
    const value = legacy[key];
    if (
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      fail(`${fileName}: adapted Product missing required field "${key}".`);
    }
  }

  console.log(
    `[product-v1] ${fileName}: ${legacy.id} �?legacy Product (${legacy.category})`,
  );
}

if (v1Count !== files.length) {
  fail(`Expected all ${files.length} product files to be Product V1, got ${v1Count}.`);
}
if (v1Count !== 13) {
  fail(`Expected 13 Product V1 files, got ${v1Count}.`);
}

clearProductCache();
const loaded = getProductByIdSync("single-monitor-arm");
if (!loaded) {
  fail('getProductByIdSync("single-monitor-arm") returned undefined.');
}
if (loaded.name !== "Compact Single Monitor Arm") {
  fail("getProductByIdSync V1 name mismatch after loader adapt.");
}
if (!loaded.amazonUrl.includes("amazon.com")) {
  fail("Adapted amazonUrl missing.");
}
if (loaded.category !== "monitors") {
  fail(
    `single-monitor-arm legacy adapter category expected "monitors", got "${loaded.category}".`,
  );
}

const armPath = path.join(productsDir, "single-monitor-arm.json");
const armRaw = JSON.parse(fs.readFileSync(armPath, "utf8")) as {
  identity: { category: string };
  classification?: { subcategory?: string };
};
if (armRaw.identity.category !== "accessories") {
  fail(
    `single-monitor-arm V1 storage category must be "accessories", got "${armRaw.identity.category}".`,
  );
}
const mapped = mapProductV1CategoryToLegacy(
  "accessories",
  armRaw.classification?.subcategory,
);
if (mapped !== "monitors") {
  fail(`mapProductV1CategoryToLegacy(accessories, monitor-arm) expected monitors, got "${mapped}".`);
}

console.log(`[product-v1] loader resolve pass: ${loaded.id}`);
console.log(
  `[product-v1] classification: V1 accessories �?legacy ${loaded.category}`,
);
console.log(`[product-v1] all ${v1Count} production product files are Product V1`);

