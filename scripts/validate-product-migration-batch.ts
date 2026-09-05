/**
 * Phase 10 Product V1 batch parity checks (Batch 1?? + final batch).
 *
 * Run: npm run validate:product-migration-batch
 *
 * Snapshots are pre-migration legacy runtime Product values.
 * After migration, products load through Product V1 ??adapter.
 */
import fs from "fs";
import path from "path";
import {
  clearArticleCache,
  getArticleSlugsSync,
  getFeaturedArticlesSync,
  getResolvedArticleSync,
} from "../src/lib/articles";
import {
  compareProductParity,
  isProductV1Document,
  mapProductV1CategoryToLegacy,
  productV1ToLegacyProduct,
  validateProductV1,
} from "../src/lib/product-schema";
import { clearProductCache, getProductByIdSync } from "../src/lib/products";
import { resolveProductRefsSync } from "../src/lib/resolve-products";
import { siteConfig } from "../src/lib/site";
import type { Product } from "../src/types/product";

function withAffiliateTag(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("tag")) {
    parsed.searchParams.set("tag", siteConfig.affiliateTag);
  }
  return parsed.toString();
}

function fail(message: string): never {
  console.error(`[product-migration-batch] ${message}`);
  process.exit(1);
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const DASH_RE = /[\u2013\u2014\u2015?]/g;

function normalizeDeep(value: unknown): unknown {
  if (typeof value === "string") return value.replace(DASH_RE, "-");
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeDeep(v)]),
    );
  }
  return value;
}

type Snapshot = {
  id: string;
  canonicalCategory: "desks" | "chairs" | "accessories";
  runtimeCategory: string;
  featured: boolean;
  amazonUrl: string;
  asin?: string;
  priceRange: string;
  rating: number;
  name: string;
  brand: string;
  image: string;
  images?: string[];
  description: string;
  verdict?: string;
  bestFor?: string;
  notFor?: string | string[];
  pros: string[];
  cons: string[];
  reviewSlug?: string;
  alternatives?: string[];
  specs?: Record<string, string | number | boolean>;
  updatedAt?: string;
  articleRefs: string[];
};

/** Pre-migration runtime snapshots captured from legacy Product JSON + loader. */
const SNAPSHOTS: Snapshot[] = [
  {
    id: "flexispot-compact",
    canonicalCategory: "desks",
    runtimeCategory: "desks",
    featured: true,
    amazonUrl: "https://www.amazon.com/s?k=flexispot+standing+desk",
    asin: "B0EXAMPLEFLEX1",
    priceRange: "From $229",
    rating: 4.7,
    name: "FlexiSpot Compact Standing Desk",
    brand: "FlexiSpot",
    image: "/products/desk.svg",
    images: ["/products/desk.svg"],
    description:
      "A reliable electric desk that stays usable at full height without eating the whole wall.",
    verdict:
      "Best sit-stand option for tight rooms when you want daily height changes without a bulky frame.",
    bestFor: "Most small apartments",
    notFor:
      "Anyone who needs premium built-in cable management or a furniture-like solid-wood desk that never moves.",
    pros: [
      "Compact width options",
      "Smooth electric lift",
      "Stable enough for dual monitors with an arm",
    ],
    cons: ["Cable tray is basic", "Assembly takes an evening"],
    updatedAt: "2026-08-17",
    reviewSlug: "flexispot-compact-standing-desk-review",
    alternatives: ["bamboo-writing-desk", "wall-folding-desk"],
    specs: {
      widthIn: 48,
      depthIn: 24,
      heightRangeIn: "29?48",
      adjustable: true,
      weightCapacityLb: 154,
      motor: "Electric",
      assemblyTimeMin: 75,
    },
    articleRefs: [
      "flexispot-compact-standing-desk-review",
      "standing-desk-vs-writing-desk",
      "best-small-desks-apartments-2026",
      "best-standing-desks-small-apartments",
    ],
  },
  {
    id: "branch-ergonomic-chair",
    canonicalCategory: "chairs",
    runtimeCategory: "chairs",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=ergonomic+office+chair",
    asin: "B0EXAMPLEBRANCH1",
    priceRange: "From $399",
    rating: 4.7,
    name: "Branch Ergonomic Chair",
    brand: "Branch",
    image: "/products/chair.svg",
    images: ["/products/chair.svg"],
    description:
      "A clean-lined chair with lumbar support that works in rooms where bulky gaming chairs feel wrong.",
    verdict:
      "Best overall office chair for small spaces when you need all-day support without a bulky gaming-chair footprint.",
    bestFor: "All-day seating in shared living spaces",
    notFor: [
      "Shoppers hunting a budget chair under $200",
      "Anyone who wants a headrest-heavy gaming look or extra-wide throne seating",
      "Users who need fully removable armrests for an ultra-shallow desk tuck",
    ],
    pros: ["Supportive lumbar", "Compact silhouette", "Breathable mesh"],
    cons: ["Premium price", "Limited color options"],
    updatedAt: "2026-08-17",
    reviewSlug: "",
    alternatives: [],
    specs: {
      adjustable: true,
      seatHeightRangeIn: "16.5?21",
      widthIn: 27,
      depthIn: 27,
      heightIn: 40,
      weightCapacityLb: 275,
      lumbarSupport: true,
      lumbarType: "Adjustable",
      armrest: true,
      armrestAdjustable: true,
      armrestRemovable: false,
      recline: true,
      meshBack: true,
      assemblyTimeMin: 35,
    },
    articleRefs: ["best-office-chairs-small-spaces-2026"],
  },
  {
    id: "monitor-arm-dual",
    canonicalCategory: "accessories",
    runtimeCategory: "monitors",
    featured: true,
    amazonUrl: "https://www.amazon.com/s?k=dual+monitor+arm",
    priceRange: "From $45",
    rating: 4.5,
    name: "VIVO Dual Monitor Arm",
    brand: "VIVO",
    image: "/products/monitor.svg",
    description:
      "Clamp-on arms reclaim desk surface and raise screens to eye level in seconds.",
    bestFor: "Freeing desk space on shallow tops",
    pros: ["Reclaims surface area", "Easy clamp install", "Smooth tilt"],
    cons: ["Needs sturdy desktop", "Cable routing is manual"],
    articleRefs: [
      "best-monitor-setup-small-home-office",
      "single-vs-dual-monitor-arm",
    ],
  },
  {
    id: "budget-standing-desk",
    canonicalCategory: "desks",
    runtimeCategory: "desks",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=budget+electric+standing+desk+small",
    asin: "B0EXAMPLEBUDGET1",
    priceRange: "From $169",
    rating: 4.4,
    name: "ApexDesk MiniRise Standing Desk",
    brand: "ApexDesk",
    image: "/products/desk.svg",
    images: ["/products/desk.svg"],
    description:
      "An affordable sit-stand desk for small apartments that need daily height changes without spending FlexiSpot money.",
    verdict:
      "Best budget standing desk when you want real height adjustment and can live without premium extras.",
    bestFor: "Budget buyers who still want electric sit-stand in a small apartment",
    notFor: [
      "Anyone who needs quiet dual motors, memory presets, or rock-solid dual-monitor stability at full height",
      "Buyers who want furniture-grade wood or built-in cable management",
    ],
    pros: [
      "Entry-level electric lift under $200",
      "Fits a 40?48 inch footprint without a premium price",
      "Simple controls and stable enough for one monitor plus laptop",
    ],
    cons: [
      "Louder motor and slower travel than mid-range desks",
      "No memory presets or cable tray included",
      "Frame feels lighter at full standing height with dual monitors",
    ],
    reviewSlug: "",
    alternatives: ["flexispot-compact"],
    specs: {
      widthIn: 48,
      depthIn: 24,
      heightRangeIn: "28?46",
      adjustable: true,
      weightCapacityLb: 110,
      motor: "Electric (entry-level)",
      assemblyTimeMin: 60,
    },
    updatedAt: "2026-08-17",
    articleRefs: ["best-standing-desks-small-apartments"],
  },
  {
    id: "budget-ergonomic-chair",
    canonicalCategory: "chairs",
    runtimeCategory: "chairs",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=sihoo+m57+ergonomic+office+chair",
    asin: "B07BDFW1Y7",
    priceRange: "From $199",
    rating: 4.5,
    name: "SIHOO M57 Ergonomic Office Chair",
    brand: "SIHOO",
    image: "/products/chair.svg",
    images: ["/products/chair.svg"],
    description:
      "A true budget ergonomic office chair with adjustable lumbar and mesh support?built for small home offices that need sit-all-day basics without Branch pricing.",
    verdict:
      "Best budget ergonomic chair when you want adjustable lumbar and mesh comfort well under a premium Branch-class price.",
    bestFor:
      "Budget buyers who still want a real adjustable ergonomic chair for a small home office",
    notFor: [
      "Anyone who needs the smallest possible apartment footprint (consider an armless task chair instead)",
      "Buyers who want premium materials, quieter mechanisms, and long-term polish closer to Branch",
      "Shoppers looking for a gaming chair aesthetic with a racing seat and oversized head pillow",
    ],
    pros: [
      "Dual-adjustable lumbar at a budget price",
      "Full mesh back stays cooler in small rooms",
      "3D armrests and seat height cover most desk setups",
    ],
    cons: [
      "Build and fine-tuning feel less refined than premium chairs",
      "Larger than ultra-compact armless task chairs",
      "Assembly instructions can be unclear",
    ],
    reviewSlug: "",
    alternatives: ["branch-ergonomic-chair"],
    specs: {
      adjustable: true,
      seatHeightRangeIn: "17.1?21.1",
      widthIn: 26,
      depthIn: 25,
      heightIn: 50,
      weightCapacityLb: 330,
      lumbarSupport: true,
      lumbarType: "Dual-adjustable",
      armrest: true,
      armrestAdjustable: true,
      armrestRemovable: false,
      recline: true,
      meshBack: true,
      assemblyTimeMin: 40,
    },
    updatedAt: "2026-08-17",
    articleRefs: ["best-office-chairs-small-spaces-2026"],
  },
  {
    id: "monitor-light-bar",
    canonicalCategory: "accessories",
    runtimeCategory: "lighting",
    featured: true,
    amazonUrl: "https://www.amazon.com/s?k=monitor+light+bar",
    priceRange: "From $89",
    rating: 4.8,
    name: "Monitor Light Bar",
    brand: "Generic",
    image: "/products/lighting.svg",
    description:
      "Asymmetric desk lighting that brightens your keyboard without washing out the screen.",
    bestFor: "Glare-free task light with zero desk footprint",
    pros: ["No desk footprint", "Excellent glare control", "Adjustable warmth"],
    cons: ["Higher cost than lamps", "Fits specific monitor thicknesses"],
    articleRefs: ["best-monitor-setup-small-home-office"],
  },
  {
    id: "space-saving-standing-desk",
    canonicalCategory: "desks",
    runtimeCategory: "desks",
    featured: false,
    amazonUrl:
      "https://www.amazon.com/s?k=narrow+compact+standing+desk+small+apartment",
    asin: "B0EXAMPLESPACE1",
    priceRange: "From $199",
    rating: 4.5,
    name: "Vivo NarrowLift Compact Standing Desk",
    brand: "Vivo",
    image: "/products/desk.svg",
    images: ["/products/desk.svg"],
    description:
      "A truly space-saving sit-stand desk built for studio apartments and tight corners where a 48-inch frame still feels oversized.",
    verdict:
      "Best space-saving standing desk when footprint matters more than desktop square footage.",
    bestFor:
      "Studio apartments and tight corners that need sit-stand without a full-width desk",
    notFor: [
      "Anyone who needs a wide dual-monitor layout or lots of surface for notebooks and docks",
      "Buyers who prefer a larger compact desk like FlexiSpot for everyday multi-device work",
    ],
    pros: [
      "Narrower footprint than a standard compact desk",
      "True sit-stand lift for studio corners and alcoves",
      "Shallow depth keeps walkways clearer in tiny rooms",
    ],
    cons: [
      "Too small for dual large monitors without an arm",
      "Limited desktop real estate for writing + keyboard sprawl",
      "Not ideal if you need a wide spread for peripherals",
    ],
    reviewSlug: "",
    alternatives: ["flexispot-compact"],
    specs: {
      widthIn: 40,
      depthIn: 20,
      heightRangeIn: "29?47",
      adjustable: true,
      weightCapacityLb: 132,
      motor: "Electric",
      assemblyTimeMin: 55,
    },
    updatedAt: "2026-08-17",
    articleRefs: ["best-standing-desks-small-apartments"],
  },
  {
    id: "space-saving-office-chair",
    canonicalCategory: "chairs",
    runtimeCategory: "chairs",
    featured: false,
    amazonUrl:
      "https://www.amazon.com/Sweetcrispy-Small-Armless-Desk-Chair/dp/B0CTJF8T2G",
    asin: "B0CTJF8T2G",
    priceRange: "From $51",
    rating: 4.4,
    name: "Sweetcrispy Small Armless Desk Chair",
    brand: "Sweetcrispy",
    image: "/products/chair.svg",
    images: ["/products/chair.svg"],
    description:
      "A compact armless mesh task chair made for studio apartments and shallow desks?prioritizing footprint and tuck-under clearance over full-day ergonomic refinement.",
    verdict:
      "Best space-saving office chair when the desk is shallow, the room is tiny, and tuck-under clearance matters more than all-day ergonomic extras.",
    bestFor:
      "Studio apartments and ultra-tight work corners that need a true small-footprint office chair",
    notFor: [
      "Long-hour heavy remote workers who need all-day flagship ergonomic support",
      "Anyone who needs advanced adjustable lumbar or armrest controls",
      "Buyers who want a premium mesh chair experience closer to Branch or SIHOO M57",
    ],
    pros: [
      "Armless design tucks under shallow desks",
      "Very small footprint for studios and tight corners",
      "Breathable mesh low back with simple lumbar curve",
    ],
    cons: [
      "Not built for all-day flagship ergonomics",
      "No armrests or advanced lumbar adjustment",
      "Low-back support feels limited on long workdays",
    ],
    reviewSlug: "",
    alternatives: ["branch-ergonomic-chair", "budget-ergonomic-chair"],
    specs: {
      adjustable: true,
      seatHeightRangeIn: "16.54?21.25",
      widthIn: 17,
      depthIn: 16,
      heightIn: 34,
      weightCapacityLb: 250,
      lumbarSupport: true,
      lumbarType: "Fixed",
      armrest: false,
      armrestAdjustable: false,
      armrestRemovable: false,
      recline: false,
      meshBack: true,
      assemblyTimeMin: 10,
    },
    updatedAt: "2026-08-17",
    articleRefs: ["best-office-chairs-small-spaces-2026"],
  },
  {
    id: "cable-tray-kit",
    canonicalCategory: "accessories",
    runtimeCategory: "storage",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=under+desk+cable+management+tray",
    priceRange: "From $28",
    rating: 4.4,
    name: "Under-Desk Cable Tray Kit",
    brand: "Generic",
    image: "/products/storage.svg",
    description:
      "A tray-and-sleeve kit that hides power bricks and keeps floors clear under a compact desk.",
    bestFor: "Quick cable cleanup in rentals",
    pros: ["Fast install", "Affordable", "Big visual improvement"],
    cons: ["Basic finish", "Limited capacity for thick bricks"],
    articleRefs: [],
  },
  {
    id: "wall-folding-desk",
    canonicalCategory: "desks",
    runtimeCategory: "desks",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=wall+mounted+folding+desk",
    priceRange: "From $89",
    rating: 4.2,
    name: "Wall-Mounted Folding Desk",
    brand: "Generic",
    image: "/products/shelf.svg",
    description:
      "Folds away when you are done?useful when the office is also the guest room.",
    bestFor: "Studios that need the floor back at night",
    pros: ["Frees floor space", "Renter-friendly with care", "Clean visual footprint"],
    cons: ["Weight limits matter", "Less ergonomic for long days"],
    articleRefs: ["best-small-desks-apartments-2026"],
  },
  {
    id: "wall-shelf-organizer",
    canonicalCategory: "accessories",
    runtimeCategory: "storage",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=wall+mounted+desk+shelf",
    priceRange: "From $36",
    rating: 4.3,
    name: "Wall-Mounted Desk Shelf",
    brand: "Generic",
    image: "/products/shelf.svg",
    description:
      "Vertical storage for notebooks, docks, and headphones when drawer space is nonexistent.",
    bestFor: "Studios without drawer space",
    pros: ["Uses wall space", "Easy reach zone", "Studio-friendly"],
    cons: ["Requires wall anchors", "Not for heavy monitors"],
    articleRefs: [],
  },
  {
    id: "bamboo-writing-desk",
    canonicalCategory: "desks",
    runtimeCategory: "desks",
    featured: false,
    amazonUrl: "https://www.amazon.com/s?k=bamboo+writing+desk+small",
    priceRange: "From $119",
    rating: 4.3,
    name: "Shallow Bamboo Writing Desk",
    brand: "Generic",
    image: "/products/desk.svg",
    description:
      "A fixed-height option when you need a calm surface and do not need sit-stand.",
    bestFor: "Laptop-only setups on a tight budget",
    pros: ["Narrow depth", "Warm, quiet look", "Easy to move"],
    cons: ["No height adjust", "Not ideal for heavy multi-monitor rigs"],
    articleRefs: [
      "standing-desk-vs-writing-desk",
      "best-small-desks-apartments-2026",
    ],
  },
];

/** Pre-final-batch bamboo runtime (legacy loader) for mixed-schema retirement proof. */
const BAMBOO_PRE_FINAL_MIGRATION: Product = {
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
};

const EXPECTED_FEATURED_ARTICLES = [
  "40-inch-desk-setup",
  "best-office-chairs-small-spaces-2026",
  "best-small-desks-apartments-2026",
  "best-standing-desks-small-apartments",
  "ergonomic-chairs-small-rooms",
  "flexispot-compact-standing-desk-review",
  "monitor-arms-small-desks",
  "standing-desk-vs-writing-desk",
].sort();

const EXPECTED_ROUTES = [
  "40-inch-desk-setup",
  "best-monitor-setup-small-home-office",
  "best-office-chairs-small-spaces-2026",
  "best-small-desks-apartments-2026",
  "best-standing-desks-small-apartments",
  "cable-management-apartment-desk",
  "ergonomic-chairs-small-rooms",
  "flexispot-compact-standing-desk-review",
  "monitor-arms-small-desks",
  "single-monitor-arm-review",
  "single-vs-dual-monitor-arm",
  "standing-desk-vs-writing-desk",
].sort();

clearProductCache();
clearArticleCache();

const migrationsDir = path.join(process.cwd(), "content/migrations");
const manifestFiles = fs
  .readdirSync(migrationsDir)
  .filter((fileName) =>
    /^product-v1-(batch-\d+|final-batch)\.json$/.test(fileName),
  )
  .sort();

const manifests = manifestFiles.map((fileName) =>
  JSON.parse(fs.readFileSync(path.join(migrationsDir, fileName), "utf8")) as {
    batch: number | string;
    products: Array<{ id: string; category: string }>;
  },
);

if (manifestFiles.length < 4) {
  fail(`expected Batch 1?? + final manifests, found ${manifestFiles.length}`);
}

const migratedIds = manifests.flatMap((item) => item.products.map((p) => p.id));
assertEqual("manifest ids", migratedIds, SNAPSHOTS.map((s) => s.id));

const productsDir = path.join(process.cwd(), "content/products");

for (const snapshot of SNAPSHOTS) {
  const filePath = path.join(productsDir, `${snapshot.id}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!isProductV1Document(raw)) {
    fail(`${snapshot.id}: expected Product V1 document after product migration batches`);
  }
  const structural = validateProductV1(raw);
  if (!structural.valid) {
    fail(`${snapshot.id} invalid V1:\n- ${structural.errors.join("\n- ")}`);
  }

  assertEqual(
    `${snapshot.id} canonical category`,
    raw.identity.category,
    snapshot.canonicalCategory,
  );

  const adapted = productV1ToLegacyProduct(raw);
  const runtime = getProductByIdSync(snapshot.id);
  if (!runtime) fail(`${snapshot.id}: getProductByIdSync returned undefined`);

  const expectedRuntimeCategory = mapProductV1CategoryToLegacy(
    raw.identity.category,
    raw.classification?.subcategory,
  );
  assertEqual(
    `${snapshot.id} runtime category`,
    runtime.category,
    snapshot.runtimeCategory,
  );
  assertEqual(
    `${snapshot.id} adapter category`,
    expectedRuntimeCategory,
    snapshot.runtimeCategory,
  );

  const snapshotAsProduct: Product = {
    id: snapshot.id,
    name: snapshot.name,
    brand: snapshot.brand,
    category: snapshot.runtimeCategory,
    image: snapshot.image,
    rating: snapshot.rating,
    priceRange: snapshot.priceRange,
    pros: snapshot.pros,
    cons: snapshot.cons,
    amazonUrl: snapshot.amazonUrl,
    description: snapshot.description,
    bestFor: snapshot.bestFor,
    featured: snapshot.featured,
    asin: snapshot.asin,
    updatedAt: snapshot.updatedAt,
    verdict: snapshot.verdict,
    notFor: Array.isArray(snapshot.notFor)
      ? snapshot.notFor
      : snapshot.notFor
        ? [snapshot.notFor]
        : undefined,
    specs: normalizeDeep(snapshot.specs) as typeof snapshot.specs,
    reviewSlug: snapshot.reviewSlug?.trim() || undefined,
    alternatives:
      snapshot.alternatives && snapshot.alternatives.length > 0
        ? snapshot.alternatives
        : undefined,
    images: snapshot.images,
  };

  const parity = compareProductParity(
    normalizeDeep(snapshotAsProduct) as typeof snapshotAsProduct,
    {
      ...normalizeDeep(adapted) as typeof adapted,
    },
    {
      allowCategoryRemap: snapshot.canonicalCategory === "accessories",
    },
  );
  if (!parity.equal) {
    fail(`${snapshot.id} runtime parity:\n- ${parity.diffs.join("\n- ")}`);
  }

  if (runtime.amazonUrl.includes("tag=")) {
    fail(`${snapshot.id}: stored amazonUrl must not include affiliate tag`);
  }
  if (JSON.stringify(raw).includes(siteConfig.affiliateTag)) {
    fail(`${snapshot.id}: Product JSON must not bake affiliate tag`);
  }
  assertEqual(`${snapshot.id} amazonUrl`, runtime.amazonUrl, snapshot.amazonUrl);
  assertEqual(
    `${snapshot.id} affiliate CTA destination`,
    withAffiliateTag(runtime.amazonUrl),
    withAffiliateTag(snapshot.amazonUrl),
  );
  assertEqual(`${snapshot.id} featured`, runtime.featured === true, snapshot.featured);
  assertEqual(`${snapshot.id} rating`, runtime.rating, snapshot.rating);
  assertEqual(`${snapshot.id} image`, runtime.image, snapshot.image);

  const runtimeParity = compareProductParity(
    normalizeDeep(snapshotAsProduct) as typeof snapshotAsProduct,
    {
      ...normalizeDeep(runtime) as typeof runtime,
    },
    {
      allowCategoryRemap: snapshot.canonicalCategory === "accessories",
    },
  );
  if (!runtimeParity.equal) {
    fail(`${snapshot.id} loader runtime parity:\n- ${runtimeParity.diffs.join("\n- ")}`);
  }

  for (const slug of snapshot.articleRefs) {
    const article = getResolvedArticleSync(slug);
    const resolved = article.resolvedProducts.find((p) => p.id === snapshot.id);
    if (!resolved) {
      fail(`${snapshot.id}: missing from article ${slug}`);
    }
    assertEqual(
      `${snapshot.id} via ${slug} amazonUrl`,
      resolved.amazonUrl,
      snapshot.amazonUrl,
    );
    assertEqual(`${snapshot.id} via ${slug} rating`, resolved.rating, snapshot.rating);
    const viaRefs = resolveProductRefsSync([{ id: snapshot.id }]);
    if (viaRefs.length !== 1 || viaRefs[0].id !== snapshot.id) {
      fail(`${snapshot.id}: resolveProductRefs failed`);
    }
  }

  console.log(
    `[product-migration-batch] PASS ${snapshot.id} (${snapshot.canonicalCategory} ??runtime ${snapshot.runtimeCategory})`,
  );
}

{
  const review = getResolvedArticleSync("flexispot-compact-standing-desk-review");
  if (review.resolvedProduct?.id !== "flexispot-compact") {
    fail("Review did not resolve flexispot-compact");
  }
  if ((review.ratingCategories ?? []).length !== 4) {
    fail("Review ratingCategories must remain article-owned");
  }
  console.log("[product-migration-batch] PASS review article resolution");
}

{
  const comparison = getResolvedArticleSync("single-vs-dual-monitor-arm");
  if (comparison.winnerId !== "monitor-arm-dual") {
    fail("Comparison winner changed");
  }
  if (comparison.resolvedProducts.length !== 2) {
    fail("Comparison product count changed");
  }
  console.log("[product-migration-batch] PASS comparison mixed/V1 resolution");
}

{
  const comparison = getResolvedArticleSync("standing-desk-vs-writing-desk");
  const flex = comparison.resolvedProducts.find((p) => p.id === "flexispot-compact");
  const bamboo = comparison.resolvedProducts.find((p) => p.id === "bamboo-writing-desk");
  const bambooRaw = JSON.parse(
    fs.readFileSync(path.join(productsDir, "bamboo-writing-desk.json"), "utf8"),
  );
  const flexRaw = JSON.parse(
    fs.readFileSync(path.join(productsDir, "flexispot-compact.json"), "utf8"),
  );
  if (!flex || !bamboo) fail("standing-desk comparison missing products");
  if (!isProductV1Document(bambooRaw) || !isProductV1Document(flexRaw)) {
    fail("standing-desk comparison products should both be Product V1 after final batch");
  }
  if (comparison.winnerId !== "flexispot-compact") {
    fail("standing-desk winner changed after final batch");
  }
  if (comparison.winnerReason !==
    "For full workdays in small rooms, a compact standing desk usually wins on long-term comfort. Choose a writing desk when budget, silence, and a calmer living-room look come first."
  ) {
    fail("standing-desk winnerReason changed");
  }
  const order = comparison.productRefs.map((ref) => ref.id);
  assertEqual("standing-desk product order", order, [
    "flexispot-compact",
    "bamboo-writing-desk",
  ]);
  if ((comparison.comparisonRows ?? []).length !== 10) {
    fail(`standing-desk comparison rows expected 10, got ${comparison.comparisonRows?.length}`);
  }
  const bambooParity = compareProductParity(BAMBOO_PRE_FINAL_MIGRATION, bamboo);
  if (!bambooParity.equal) {
    fail(
      `bamboo post-migration runtime differs from pre-final legacy baseline:\n- ${bambooParity.diffs.join("\n- ")}`,
    );
  }
  console.log(
    "[product-migration-batch] PASS mixed-schema retired (V1+V1 comparison equivalent to pre-final V1+legacy)",
  );
}

{
  const flexRaw = JSON.parse(
    fs.readFileSync(path.join(productsDir, "flexispot-compact.json"), "utf8"),
  ) as { relationships?: { relatedProducts?: string[] } };
  const related = flexRaw.relationships?.relatedProducts ?? [];
  assertEqual("flexispot relatedProducts", related, [
    "bamboo-writing-desk",
    "wall-folding-desk",
  ]);
  for (const id of related) {
    if (!getProductByIdSync(id)) fail(`flexispot related product unresolved: ${id}`);
    const raw = JSON.parse(
      fs.readFileSync(path.join(productsDir, `${id}.json`), "utf8"),
    );
    if (!isProductV1Document(raw)) {
      fail(`flexispot related product ${id} should be Product V1`);
    }
  }
  console.log("[product-migration-batch] PASS flexispot relationships resolve");
}

{
  const best = getResolvedArticleSync("best-small-desks-apartments-2026");
  const bamboo = best.resolvedProducts.find((p) => p.id === "bamboo-writing-desk");
  const folding = best.resolvedProducts.find((p) => p.id === "wall-folding-desk");
  if (!bamboo || !folding) fail("Small-desks best list missing final-batch products");
  if (bamboo.badge !== "Best Budget" || bamboo.rank !== 2) {
    fail("Small-desks best list bamboo role/rank changed");
  }
  if (folding.badge !== "Best Space Saving" || folding.rank !== 3) {
    fail("Small-desks best list wall-folding role/rank changed");
  }
  if (best.winnerId !== "flexispot-compact") fail("Small-desks best list winner changed");
  console.log("[product-migration-batch] PASS small-desks best-list final products");
}

{
  const best = getResolvedArticleSync("best-office-chairs-small-spaces-2026");
  const overall = best.resolvedProducts.find((p) => p.id === "branch-ergonomic-chair");
  const budget = best.resolvedProducts.find((p) => p.id === "budget-ergonomic-chair");
  if (!overall || !budget) fail("Chair best list missing Branch or budget chair");
  if (overall.badge !== "Best Overall") fail("Chair best list overall badge changed");
  if (budget.badge !== "Best Budget") fail("Chair best list budget badge changed");
  if (overall.rank !== 1 || budget.rank !== 2) fail("Chair best list ranking changed");
  if (best.winnerId !== "branch-ergonomic-chair") fail("Chair best list winner changed");
  if (
    budget.summary !==
    "The best budget ergonomic office chair when you want real adjustability without paying Branch-class money."
  ) {
    fail("Chair best list article summary was overwritten");
  }
  console.log("[product-migration-batch] PASS best-list article resolution");
}

{
  const best = getResolvedArticleSync("best-standing-desks-small-apartments");
  const budget = best.resolvedProducts.find((p) => p.id === "budget-standing-desk");
  const space = best.resolvedProducts.find((p) => p.id === "space-saving-standing-desk");
  if (!budget || !space) fail("Standing-desk best list missing products");
  if (budget.badge !== "Best Budget" || budget.rank !== 2) {
    fail("Standing-desk best list budget role/rank changed");
  }
  if (space.badge !== "Best Space Saving" || space.rank !== 3) {
    fail("Standing-desk best list space-saving role/rank changed");
  }
  if (best.winnerId !== "flexispot-compact") fail("Standing-desk best list winner changed");
  const spaceRaw = JSON.parse(
    fs.readFileSync(path.join(productsDir, "space-saving-standing-desk.json"), "utf8"),
  );
  if (!isProductV1Document(spaceRaw)) {
    fail("space-saving-standing-desk should be Product V1 after Batch 3");
  }
  console.log("[product-migration-batch] PASS standing-desk best-list resolution");
}

{
  const best = getResolvedArticleSync("best-office-chairs-small-spaces-2026");
  const space = best.resolvedProducts.find((p) => p.id === "space-saving-office-chair");
  if (!space) fail("Chair best list missing space-saving chair");
  if (space.badge !== "Best Space Saving" || space.rank !== 3) {
    fail("Chair best list space-saving role/rank changed");
  }
  if (
    space.amazonUrl !==
    "https://www.amazon.com/Sweetcrispy-Small-Armless-Desk-Chair/dp/B0CTJF8T2G"
  ) {
    fail("space-saving-office-chair ASIN detail URL changed");
  }
  if (space.asin !== "B0CTJF8T2G") fail("space-saving-office-chair ASIN changed");
  console.log("[product-migration-batch] PASS chair best-list ASIN detail URL");
}

{
  const tray = getProductByIdSync("cable-tray-kit");
  const trayRaw = JSON.parse(
    fs.readFileSync(path.join(productsDir, "cable-tray-kit.json"), "utf8"),
  );
  if (!tray || !isProductV1Document(trayRaw)) fail("cable-tray-kit should be Product V1");
  if (tray.category !== "storage") {
    fail(`cable-tray-kit runtime category expected storage, got ${tray.category}`);
  }
  if (trayRaw.classification?.subcategory !== "cable-management") {
    fail("cable-tray-kit subcategory expected cable-management");
  }
  if (tray.specs && Object.keys(tray.specs).length > 0) {
    fail("cable-tray-kit should remain sparse with no invented specs");
  }
  console.log("[product-migration-batch] PASS sparse storage accessory remap");
}

{
  const best = getResolvedArticleSync("best-monitor-setup-small-home-office");
  const light = best.resolvedProducts.find((p) => p.id === "monitor-light-bar");
  if (!light) fail("Monitor best list missing light bar");
  if (light.badge !== "Best Space Saving" || light.rank !== 2) {
    fail("Monitor best list light-bar role/rank changed");
  }
  if (light.category !== "lighting") {
    fail(`monitor-light-bar runtime category expected lighting, got ${light.category}`);
  }
  if (light.featured !== true) fail("monitor-light-bar featured state changed");
  console.log("[product-migration-batch] PASS accessory best-list resolution");
}

assertEqual("public routes", getArticleSlugsSync().sort(), EXPECTED_ROUTES);
assertEqual(
  "featured articles",
  getFeaturedArticlesSync().map((a) => a.slug).sort(),
  EXPECTED_FEATURED_ARTICLES,
);

let v1Count = 0;
let legacyCount = 0;
const ids = new Set<string>();
for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
  const parsed = JSON.parse(fs.readFileSync(path.join(productsDir, fileName), "utf8")) as {
    id?: string;
  };
  if (!parsed.id) fail(`${fileName} missing id`);
  if (ids.has(parsed.id)) fail(`Duplicate product id: ${parsed.id}`);
  ids.add(parsed.id);
  if (isProductV1Document(parsed)) v1Count += 1;
  else legacyCount += 1;
}

if (ids.size !== 13) fail(`Total Product IDs expected 13, got ${ids.size}`);
if (v1Count !== 13) fail(`Product V1 count expected 13, got ${v1Count}`);
if (legacyCount !== 0) fail(`Legacy Product count expected 0, got ${legacyCount}`);

console.log("[product-migration-batch] PASS Product V1 count (13)");
console.log("[product-migration-batch] PASS legacy Product count (0)");
console.log("[product-migration-batch] PASS total IDs (13)");
console.log("[product-migration-batch] PASS routes (12) featured articles (8)");
console.log("[product-migration-batch] Batch 1?? + final batch parity passed");


