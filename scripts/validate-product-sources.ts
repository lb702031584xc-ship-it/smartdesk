/**
 * Production Product source invariant checks.
 *
 * Run: npm run validate:product-sources
 *
 * Every content/products/*.json must be Product Schema V1 with a unique id.
 */
import fs from "fs";
import path from "path";
import { isProductV1Document, validateProductV1 } from "../src/lib/product-schema";

function fail(message: string): never {
  console.error(`[product-sources] ${message}`);
  process.exit(1);
}

const productsDir = path.join(process.cwd(), "content/products");
const files = fs
  .readdirSync(productsDir)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();

const errors: string[] = [];
const ids = new Map<string, string>();
let v1Count = 0;
let legacyCount = 0;

for (const fileName of files) {
  const filePath = path.join(productsDir, fileName);
  const expectedId = fileName.replace(/\.json$/, "");
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    errors.push(`${fileName}: invalid JSON (${detail})`);
    continue;
  }

  if (!isProductV1Document(parsed)) {
    legacyCount += 1;
    const id =
      parsed && typeof parsed === "object" && parsed !== null && "id" in parsed
        ? String((parsed as { id: unknown }).id)
        : "(unknown)";
    errors.push(
      `${fileName} (id: ${id}) must be Product V1 (schemaVersion: 1).`,
    );
    continue;
  }

  v1Count += 1;
  const result = validateProductV1(parsed);
  if (!result.valid) {
    errors.push(`${fileName}: ${result.errors.join("; ")}`);
    continue;
  }

  if (parsed.id !== expectedId) {
    errors.push(
      `${fileName}: id "${parsed.id}" must match filename "${expectedId}"`,
    );
  }

  if (ids.has(parsed.id)) {
    errors.push(`Duplicate product id "${parsed.id}" (${ids.get(parsed.id)} vs ${fileName})`);
  } else {
    ids.set(parsed.id, fileName);
  }
}

if (errors.length > 0) {
  fail(`Product source errors:\n- ${errors.join("\n- ")}`);
}

if (files.length !== 13) {
  fail(`Expected 13 product files, found ${files.length}`);
}
if (v1Count !== 13) {
  fail(`Expected 13 Product V1 files, found ${v1Count}`);
}
if (legacyCount !== 0) {
  fail(`Expected 0 legacy Product files, found ${legacyCount}`);
}

console.log(`[product-sources] Product JSON files: ${files.length}`);
console.log("[product-sources] Product V1 files: 13");
console.log("[product-sources] Legacy Product files: 0");
console.log("[product-sources] duplicate product ids: 0");
console.log("[product-sources] production Product sources OK");
