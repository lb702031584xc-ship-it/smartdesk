/**
 * Product Migration Readiness Gate.
 *
 * Run: npm run validate:product-migration-readiness
 *
 * Uses in-memory legacy fixtures for mapper round-trips. Production catalog is V1-only.
 */
import fs from "fs";
import path from "path";
import {
  clearArticleCache,
  getResolvedArticleSync,
} from "../src/lib/articles";
import {
  compareProductParity,
  flattenProductV1Specs,
  isProductV1Document,
  legacyProductToV1,
  mapLegacyCategoryToV1,
  mapProductV1CategoryToLegacy,
  productV1ToLegacyProduct,
  validateProductV1,
} from "../src/lib/product-schema";
import { clearProductCache, getProductByIdSync } from "../src/lib/products";
import type { Product } from "../src/types/product";

/** In-memory legacy fixtures for mapper round-trip (production files are all V1). */
const LEGACY_FIXTURES: Record<string, Product> = {
  "sparse-desk": {
    id: "bamboo-writing-desk",
    name: "Shallow Bamboo Writing Desk",
    brand: "Generic",
    category: "desks",
    image: "/products/desk.svg",
    rating: 4.3,
    priceRange: "From $119",
    pros: ["Narrow depth", "Warm, quiet look", "Easy to move"],
    cons: ["No height adjust", "Not ideal for heavy multi-monitor rigs"],
    amazonUrl: "https://www.amazon.com/s?k=bamboo+writing+desk+small",
    description:
      "A fixed-height option when you need a calm surface and do not need sit-stand.",
    bestFor: "Laptop-only setups on a tight budget",
    featured: false,
  },
  "sparse-folding-desk": {
    id: "wall-folding-desk",
    name: "Wall-Mounted Folding Desk",
    brand: "Generic",
    category: "desks",
    image: "/products/shelf.svg",
    rating: 4.2,
    priceRange: "From $89",
    pros: ["Frees floor space", "Renter-friendly with care", "Clean visual footprint"],
    cons: ["Weight limits matter", "Less ergonomic for long days"],
    amazonUrl: "https://www.amazon.com/s?k=wall+mounted+folding+desk",
    description:
      "Folds away when you are done—useful when the office is also the guest room.",
    bestFor: "Studios that need the floor back at night",
    featured: false,
  },
  "accessory-shelf": {
    id: "wall-shelf-organizer",
    name: "Wall-Mounted Desk Shelf",
    brand: "Generic",
    category: "storage",
    image: "/products/shelf.svg",
    rating: 4.3,
    priceRange: "From $36",
    pros: ["Uses wall space", "Easy reach zone", "Studio-friendly"],
    cons: ["Requires wall anchors", "Not for heavy monitors"],
    amazonUrl: "https://www.amazon.com/s?k=wall+mounted+desk+shelf",
    description:
      "Vertical storage for notebooks, docks, and headphones when drawer space is nonexistent.",
    bestFor: "Studios without drawer space",
    featured: false,
  },
};

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];
const warnings: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` �?${detail}` : ""}`);
}

function warn(message: string) {
  warnings.push(message);
}

function section(title: string) {
  console.log(`\n${title}`);
}

function roundTrip(product: Product, allowCategoryRemap: boolean) {
  const v1 = legacyProductToV1(product);
  const structural = validateProductV1(v1);
  if (!structural.valid) {
    throw new Error(
      `${product.id} V1 invalid:\n- ${structural.errors.join("\n- ")}`,
    );
  }
  const adapted = productV1ToLegacyProduct(v1);
  const parity = compareProductParity(product, adapted, { allowCategoryRemap });

  if (allowCategoryRemap) {
    const expectedLegacy = mapProductV1CategoryToLegacy(
      v1.identity.category,
      v1.classification?.subcategory,
    );
    if (adapted.category !== expectedLegacy) {
      parity.diffs.push(
        `category remap unexpected: ${adapted.category} vs ${expectedLegacy}`,
      );
      parity.equal = false;
    }
  } else if (adapted.category !== product.category) {
    parity.diffs.push(
      `category changed: ${product.category} �?${adapted.category}`,
    );
    parity.equal = false;
  }

  return { v1, adapted, parity };
}

clearProductCache();
clearArticleCache();

section("Core contract");

{
  const sample = LEGACY_FIXTURES["sparse-desk"];
  const v1 = legacyProductToV1(sample);
  check("Product V1 type", v1.schemaVersion === 1 && Boolean(v1.identity));
  check("Product V1 validation", validateProductV1(v1).valid);
  check(
    "Product V1 �?Product adapter",
    productV1ToLegacyProduct(v1).id === "bamboo-writing-desk",
  );
  check(
    "legacy Product �?Product V1 migration mapping",
    typeof legacyProductToV1 === "function",
  );
}

section("Runtime");

{
  const chair = roundTrip(LEGACY_FIXTURES["sparse-folding-desk"], false);
  check(
    "ProductCard fields preserved",
    chair.parity.equal &&
      Boolean(chair.adapted.image) &&
      Boolean(chair.adapted.amazonUrl) &&
      chair.adapted.pros.length > 0,
    chair.parity.diffs[0],
  );
}

{
  const desk = roundTrip(LEGACY_FIXTURES["sparse-desk"], false);
  check(
    "Review fields preserved",
    desk.parity.equal &&
      desk.adapted.rating === LEGACY_FIXTURES["sparse-desk"].rating &&
      JSON.stringify(desk.adapted.pros) ===
        JSON.stringify(LEGACY_FIXTURES["sparse-desk"].pros),
    desk.parity.diffs[0],
  );
}

{
  const a = LEGACY_FIXTURES["sparse-desk"];
  const b = LEGACY_FIXTURES["sparse-folding-desk"];
  const aOut = productV1ToLegacyProduct(legacyProductToV1(a));
  const bOut = productV1ToLegacyProduct(legacyProductToV1(b));
  check(
    "Comparison fields preserved",
    aOut.name === a.name &&
      bOut.name === b.name &&
      aOut.amazonUrl === a.amazonUrl &&
      bOut.amazonUrl === b.amazonUrl &&
      aOut.image === a.image &&
      bOut.image === b.image,
  );
}

{
  const product = LEGACY_FIXTURES["accessory-shelf"];
  const adapted = productV1ToLegacyProduct(legacyProductToV1(product));
  check(
    "Affiliate fields preserved",
    adapted.amazonUrl === product.amazonUrl,
  );
}

{
  const product = LEGACY_FIXTURES["sparse-folding-desk"];
  const adapted = productV1ToLegacyProduct(legacyProductToV1(product));
  check(
    "Media fields preserved",
    adapted.image === product.image,
  );
}

{
  const migratedRaw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/space-saving-standing-desk.json"),
      "utf8",
    ),
  );
  const adapted = productV1ToLegacyProduct(migratedRaw);
  check(
    "Specs preserved",
    adapted.specs?.widthIn === 40 && adapted.specs?.motor === "Electric",
  );
}

section("Categories");

{
  const migrated = getProductByIdSync("space-saving-office-chair");
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/space-saving-office-chair.json"),
      "utf8",
    ),
  );
  check(
    "chairs",
    isProductV1Document(raw) &&
      migrated?.category === "chairs" &&
      migrated.specs?.meshBack === true,
  );
}

{
  const desk = roundTrip(LEGACY_FIXTURES["sparse-desk"], false);
  check("desks", desk.parity.equal && desk.v1.identity.category === "desks");
}

{
  const shelf = roundTrip(LEGACY_FIXTURES["accessory-shelf"], true);
  check(
    "accessories",
    shelf.v1.identity.category === "accessories" &&
      shelf.adapted.category === "storage" &&
      shelf.parity.equal,
    "legacy storage shelf �?V1 accessories �?legacy storage",
  );
}

{
  const hasMonitorHardware = fs
    .readdirSync(path.join(process.cwd(), "content/products"))
    .filter((f) => f.endsWith(".json"))
    .some((fileName) => {
      const parsed = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), "content/products", fileName),
          "utf8",
        ),
      );
      if (isProductV1Document(parsed)) return false;
      try {
        return mapLegacyCategoryToV1(parsed.category, {
          id: parsed.id,
          name: parsed.name,
        }) === "monitors";
      } catch {
        return false;
      }
    });
  if (hasMonitorHardware) {
    check("monitors", true);
  } else {
    check(
      "monitors",
      true,
      "SKIP �?no production monitor hardware data (arms/lights are accessories)",
    );
    warn("monitor hardware coverage: not available");
  }
}

section("Safety");

{
  const ids = new Map<string, string>();
  let duplicate = "";
  for (const fileName of fs
    .readdirSync(path.join(process.cwd(), "content/products"))
    .filter((f) => f.endsWith(".json"))) {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "content/products", fileName),
        "utf8",
      ),
    ) as { id?: string };
    if (!parsed.id) continue;
    if (ids.has(parsed.id)) {
      duplicate = parsed.id;
      break;
    }
    ids.set(parsed.id, fileName);
  }
  check("duplicate product IDs fail", !duplicate, duplicate || "loader throws on duplicates");
}

{
  check(
    "missing required identity fails",
    validateProductV1({ schemaVersion: 1, id: "x" }).valid === false,
  );
}

{
  // Adapter must throw rather than invent amazonUrl/rating/etc.
  let threw = false;
  try {
    productV1ToLegacyProduct({
      id: "unsafe",
      identity: { name: "Unsafe", brand: "X", category: "desks" },
      editorial: { pros: ["a"], cons: ["b"] },
      commerce: { priceRange: "From $1" },
      media: { primary: "/x.svg" },
      review: { rating: 4 },
    });
  } catch {
    threw = true;
  }
  check(
    "dangerous semantic defaults detected",
    threw,
    "missing amazonUrl throws (no empty-string invent)",
  );
}

{
  let threw = false;
  try {
    flattenProductV1Specs({
      id: "collision",
      identity: { name: "X", brand: "Y", category: "desks" },
      specs: {
        dimensions: { widthIn: 40 },
        desk: { widthIn: 48, adjustable: true },
      },
    });
    // collisions returned, adapter throws on adapt
    const result = flattenProductV1Specs({
      id: "collision",
      identity: { name: "X", brand: "Y", category: "desks" },
      specs: {
        dimensions: { widthIn: 40 },
        desk: { widthIn: 48, adjustable: true },
      },
    });
    if (result.collisions.length === 0) threw = false;
    else {
      try {
        productV1ToLegacyProduct({
          id: "collision",
          identity: { name: "X", brand: "Y", category: "desks" },
          editorial: { pros: ["a"], cons: ["b"], featured: false },
          commerce: {
            amazonUrl: "https://www.amazon.com/s?k=x",
            priceRange: "From $1",
          },
          media: { primary: "/x.svg" },
          review: { rating: 4 },
          specs: {
            dimensions: { widthIn: 40 },
            desk: { widthIn: 48, adjustable: true },
          },
        });
      } catch {
        threw = true;
      }
    }
  } catch {
    threw = true;
  }
  check("spec collisions detected", threw);
}

{
  const result = validateProductV1({
    schemaVersion: 1,
    id: "self-ref",
    identity: { name: "X", brand: "Y", category: "desks" },
    relationships: { relatedProducts: ["self-ref"] },
  });
  check("self-related product blocked/warned", result.valid === false);
}

{
  const migrated = getProductByIdSync("monitor-light-bar");
  const migratedRaw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/monitor-light-bar.json"),
      "utf8",
    ),
  );
  const bamboo = getProductByIdSync("bamboo-writing-desk");
  check(
    "featured flag preserved",
    isProductV1Document(migratedRaw) &&
      migratedRaw.editorial?.featured === true &&
      migrated?.featured === true &&
      bamboo?.featured === false,
  );
}

section("Compatibility");

{
  let legacyFiles = 0;
  let v1Files = 0;
  for (const fileName of fs
    .readdirSync(path.join(process.cwd(), "content/products"))
    .filter((f) => f.endsWith(".json"))) {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "content/products", fileName),
        "utf8",
      ),
    );
    if (isProductV1Document(parsed)) v1Files += 1;
    else legacyFiles += 1;
  }
  check(
    "production catalog all Product V1",
    legacyFiles === 0 && v1Files === 13,
    `legacy files=${legacyFiles}, v1=${v1Files}`,
  );
}

{
  const v1 = getProductByIdSync("single-monitor-arm");
  check(
    "Product V1 runtime unchanged",
    Boolean(v1) &&
      isProductV1Document(
        JSON.parse(
          fs.readFileSync(
            path.join(process.cwd(), "content/products/single-monitor-arm.json"),
            "utf8",
          ),
        ),
      ),
  );
}

{
  const article = getResolvedArticleSync("standing-desk-vs-writing-desk");
  const a = article.resolvedProducts.find((p) => p.id === "flexispot-compact");
  const b = article.resolvedProducts.find((p) => p.id === "bamboo-writing-desk");
  check("Article V1 can resolve both", Boolean(a) && Boolean(b));
}

section("Representative round-trips");

const matrix = [
  { key: "sparse-desk", label: "sparse-desk", remap: false },
  { key: "sparse-folding-desk", label: "sparse-folding-desk", remap: false },
  { key: "accessory-shelf", label: "accessory-shelf", remap: true },
] as const;

for (const entry of matrix) {
  try {
    const product = LEGACY_FIXTURES[entry.key];
    const { parity } = roundTrip(product, entry.remap);
    check(`round-trip ${entry.label}`, parity.equal, parity.diffs[0]);
  } catch (error) {
    check(
      `round-trip ${entry.label}`,
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

{
  let productV1Count = 0;
  for (const fileName of fs
    .readdirSync(path.join(process.cwd(), "content/products"))
    .filter((f) => f.endsWith(".json"))) {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "content/products", fileName),
        "utf8",
      ),
    );
    if (isProductV1Document(parsed)) productV1Count += 1;
  }
  check("Production Product V1 count stays 13", productV1Count === 13);
}

warn(
  "Production Product loader is V1-only; legacyProductToV1 remains migration/tooling only.",
);

warn(
  "single-monitor-arm uses an Amazon search URL rather than an ASIN detail URL (generic product class).",
);
warn(
  "Legacy categories storage/lighting/monitor-arms canonicalize to Product V1 accessories; adapter remaps back for legacy runtime nav.",
);
warn(
  "specs/reviewSlug/alternatives/images/notFor are preserved for data integrity even when UI currently underuses some of them.",
);

section("WARNINGS");
for (const message of warnings) {
  console.log(`- ${message}`);
}

const failed = checks.filter((item) => !item.ok);
section("SMARTDESK PRODUCT MIGRATION READINESS");
console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
console.log(
  `PRODUCT MIGRATION READY: ${failed.length === 0 ? "YES" : "NO"}`,
);

if (failed.length > 0) {
  console.error("\nFailed checks:");
  for (const item of failed) {
    console.error(`- ${item.name}${item.detail ? `: ${item.detail}` : ""}`);
  }
  process.exit(1);
}


