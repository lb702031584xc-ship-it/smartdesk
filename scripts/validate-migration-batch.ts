/**
 * Phase 7 migration parity checks (Batch 1 + Batch 2).
 *
 * Run: npm run validate:migration-batch
 *
 * Snapshots capture pre-migration legacy runtime expectations.
 * Articles are loaded through the production V1 path after migration.
 */
import fs from "fs";
import path from "path";
import {
  clearArticleCache,
  getArticleSlugsSync,
  getFeaturedArticlesSync,
  getResolvedArticleSync,
} from "../src/lib/articles";
import { isProductV1Document } from "../src/lib/product-schema";
import { clearProductCache } from "../src/lib/products";
import { buildArticleJsonLd } from "../src/lib/seo";

type Snapshot = {
  batch: 1 | 2;
  slug: string;
  title: string;
  type: "best" | "review" | "comparison" | "guide";
  description: string;
  productIds: string[];
  winnerId?: string;
  winnerReason?: string;
  faqCount: number;
  faqQuestions: string[];
  faqAnswers?: string[];
  ratingCategoryLabels?: string[];
  ratingCategoryScores?: number[];
  comparisonRowFeatures?: string[];
  comparisonRowValues?: string[][];
  featured: boolean;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  methodology?: string;
  badges?: Array<string | undefined>;
  summaries?: Array<string | undefined>;
  verdict?: string;
  relatedCount?: number;
  relatedTitles?: string[];
  relatedHrefs?: string[];
  coverImage?: string;
  intro?: string;
  category?: string;
  tags?: string[];
};

/** Pre-migration featured slug set (captured before Batch 2). */
const EXPECTED_FEATURED = [
  "40-inch-desk-setup",
  "best-office-chairs-small-spaces-2026",
  "best-small-desks-apartments-2026",
  "best-standing-desks-small-apartments",
  "ergonomic-chairs-small-rooms",
  "flexispot-compact-standing-desk-review",
  "monitor-arms-small-desks",
  "standing-desk-vs-writing-desk",
].sort();

/** Pre-migration public route set. */
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

/** Pre-migration snapshots for Batch 1 + Batch 2. */
const SNAPSHOTS: Snapshot[] = [
  {
    batch: 1,
    slug: "best-office-chairs-small-spaces-2026",
    title: "Best Office Chairs for Small Spaces in 2026",
    type: "best",
    description:
      "The best office chairs for small spaces in 2026—compact ergonomic and small home office chair picks ranked for footprint, tuck-under fit, and everyday support.",
    productIds: [
      "branch-ergonomic-chair",
      "budget-ergonomic-chair",
      "space-saving-office-chair",
    ],
    winnerId: "branch-ergonomic-chair",
    winnerReason:
      "Best balance of all-day support, compact silhouette, and living-room-friendly design for most small-space workdays.",
    faqCount: 4,
    faqQuestions: [
      "What makes a chair good for small spaces?",
      "Do I need a fully adjustable ergonomic chair in a studio?",
      "Should I buy the chair or the desk first?",
      "Are armless chairs okay for full workdays?",
    ],
    featured: true,
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    author: "SmartDeskSetup Editorial",
    methodology:
      "We ranked chairs for small home offices by footprint, tuck-under clearance under shallow desks, seat-height adjustability, lumbar support quality, visual bulk in shared rooms, and value. Prices and availability can change on Amazon.",
    badges: ["Best Overall", "Best Budget", "Best Space Saving"],
    summaries: [
      "The best overall compact ergonomic chair for most small home offices that need all-day support without a bulky footprint.",
      "The best budget ergonomic office chair when you want real adjustability without paying Branch-class money.",
      "The best space-saving small home office chair for studios and shallow desks that need maximum tuck-under clearance.",
    ],
    relatedCount: 3,
    coverImage: "/images/articles/best-office-chairs-small-spaces.jpg",
    intro:
      "In a small room, the best office chair is the one that supports real work without blocking the walkway or looking like a gaming throne.",
  },
  {
    batch: 1,
    slug: "flexispot-compact-standing-desk-review",
    title: "FlexiSpot Compact Standing Desk Review",
    type: "review",
    description:
      "An honest review of the FlexiSpot compact standing desk for apartment offices—stability, noise, assembly, and who should buy it.",
    productIds: ["flexispot-compact"],
    faqCount: 3,
    faqQuestions: [
      "Is this desk quiet enough for shared apartments?",
      "Can renters assemble it alone?",
      "Does it work with a monitor arm?",
    ],
    ratingCategoryLabels: [
      "Stability",
      "Space efficiency",
      "Ease of use",
      "Value",
    ],
    ratingCategoryScores: [4.6, 4.8, 4.7, 4.5],
    featured: true,
    publishedAt: "2026-08-13",
    updatedAt: "2026-08-13",
    author: "SmartDeskSetup Editorial",
    summaries: [
      "A compact electric standing desk that feels more premium than its price suggests, with a few cable-management compromises.",
    ],
    verdict:
      "Buy it if you want sit-stand flexibility without a bulky frame. Skip it if you need a polished built-in cable system out of the box.",
    relatedCount: 2,
    intro:
      "We tested this desk as a primary workstation in a spare-room setup with one monitor on an arm and a compact ergonomic chair.",
  },
  {
    batch: 1,
    slug: "standing-desk-vs-writing-desk",
    title: "Standing Desk vs Writing Desk for Small Rooms",
    type: "comparison",
    description:
      "Standing desk vs writing desk for small rooms, apartments, and studio offices—compare footprint, comfort, and budget so you can choose the right desk for a tight home workspace.",
    productIds: ["flexispot-compact", "bamboo-writing-desk"],
    winnerId: "flexispot-compact",
    winnerReason:
      "For full workdays in small rooms, a compact standing desk usually wins on long-term comfort. Choose a writing desk when budget, silence, and a calmer living-room look come first.",
    faqCount: 3,
    faqQuestions: [
      "Can a writing desk still be ergonomic?",
      "Is a standing desk worth it in a tiny room?",
      "Which should I buy first?",
    ],
    comparisonRowFeatures: [
      "Starting price",
      "Height adjustment",
      "Footprint",
      "Depth",
      "Cable management",
      "Apartment flexibility",
      "Long work days",
      "Best room type",
      "Noise",
      "Ideal user",
    ],
    comparisonRowValues: [
      ["From $229", "From $119"],
      ["Electric sit-stand", "Fixed"],
      [
        "Compact freestanding frame (~48 in wide)",
        "Shallow fixed footprint, easier to tuck",
      ],
      [
        "About 24 in—plan for chair clearance",
        "Shallower top—better for tight walkways",
      ],
      [
        "Basic tray; motor and power brick need planning",
        "Minimal cables; easier to keep visually clean",
      ],
      [
        "Strong for daily posture changes in a fixed corner",
        "Stronger when the room must stay guest-ready",
      ],
      [
        "Better for 6+ hour remote workdays",
        "Fine for lighter or hybrid laptop days",
      ],
      [
        "Studio corner or spare-room nook with walkway room",
        "Studio / living-room edge shared with daily life",
      ],
      ["Short motor hum when moving", "Silent"],
      [
        "Remote workers at the desk 6+ hours",
        "Hybrid laptop users needing simplicity",
      ],
    ],
    featured: true,
    publishedAt: "2026-08-11",
    updatedAt: "2026-08-17",
    author: "SmartDeskSetup Editorial",
    badges: ["Best for all-day work", "Best simple setup"],
    relatedCount: 3,
    coverImage: "/images/articles/standing-desk-vs-writing-desk.jpg",
    intro:
      "In a small room, apartment, or studio, the better desk is the one that protects your walkway, matches your workday, and still feels like furniture you can live with.",
  },
  {
    batch: 1,
    slug: "40-inch-desk-setup",
    title: "How to Build a 40-Inch Desk Setup That Still Feels Premium",
    type: "guide",
    description:
      "A practical layout for apartment desks under 40 inches wide, including monitor height, storage, and cable control.",
    productIds: [],
    faqCount: 0,
    faqQuestions: [],
    featured: true,
    publishedAt: "2026-08-10",
  },
  {
    batch: 2,
    slug: "best-small-desks-apartments-2026",
    title: "Best Small Desks for Apartments in 2026",
    type: "best",
    description:
      "Looking for the best small desk for an apartment? We ranked compact desks by footprint, stability, comfort, and everyday value for small home offices.",
    productIds: [
      "flexispot-compact",
      "bamboo-writing-desk",
      "wall-folding-desk",
    ],
    winnerId: "flexispot-compact",
    winnerReason:
      "Best balance of footprint, sit-stand flexibility, and daily stability.",
    faqCount: 4,
    faqQuestions: [
      "What size is best for a small apartment desk?",
      "Do I need a standing desk in a small apartment?",
      "Can a small desk support two monitors?",
      "What should I buy first: desk or chair?",
    ],
    faqAnswers: [
      "Most apartments do well with a desk between 40 and 48 inches wide and about 20 to 24 inches deep. Prioritize leaving a clear walkway behind the chair.",
      "Not always. If you work long hours and want posture changes, a compact standing desk is worth it. If the room is mainly shared living space, a shallow fixed desk can be the smarter choice.",
      "Many can, especially with a monitor arm. Check weight capacity and avoid placing heavy screens on the far edge of a shallow desktop.",
      "Buy the desk first if footprint is your biggest constraint. Then choose a chair that tucks under the desk and fits the remaining clearance.",
    ],
    featured: true,
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    author: "SmartDeskSetup Editorial",
    methodology:
      "We evaluated compact desks for apartments based on footprint, depth, stability during daily use, assembly reality in small rooms, and value. Prices and availability can change on Amazon.",
    badges: ["Best Overall", "Best Budget", "Best Space Saving"],
    summaries: [
      "Best for most apartment workdays that need sit-stand flexibility.",
      "Best simple fixed desk for people who want a lower-cost and calm workspace.",
      "Best choice when the room needs to open back up after work.",
    ],
    relatedCount: 3,
    relatedTitles: [
      "Best Standing Desks for Small Apartments",
      "FlexiSpot Compact Standing Desk Review",
      "Standing Desk vs Writing Desk for Small Rooms",
    ],
    relatedHrefs: [
      "/blog/best-standing-desks-small-apartments",
      "/blog/flexispot-compact-standing-desk-review",
      "/blog/standing-desk-vs-writing-desk",
    ],
    coverImage: "/images/articles/best-small-desks-apartments.jpg",
    intro:
      "In an apartment, a desk has to earn its space. The best small desk for an apartment is stable enough for real work, shallow enough for a walkway, and calm enough to live next to a sofa or bed.",
    category: "desks",
    tags: [
      "best small desk for apartment",
      "small desk",
      "apartment office",
      "compact desk",
      "best of",
    ],
  },
  {
    batch: 2,
    slug: "best-standing-desks-small-apartments",
    title: "Best Standing Desks for Small Apartments (2026)",
    type: "best",
    description:
      "The best standing desks for small apartments—compact sit-stand picks ranked for footprint, stability, and remote-work comfort.",
    productIds: [
      "flexispot-compact",
      "budget-standing-desk",
      "space-saving-standing-desk",
    ],
    winnerId: "flexispot-compact",
    winnerReason:
      "Best balance of footprint, stability, comfort and everyday value for small apartment workspaces.",
    faqCount: 3,
    faqQuestions: [
      "What desk width works in a small apartment?",
      "Do I need a standing desk?",
      "Will these desks hold two monitors?",
    ],
    featured: true,
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-17",
    author: "SmartDeskSetup Editorial",
    methodology:
      "We prioritized desks under 48 inches wide, stable height adjustment, cable-management options, and realistic apartment assembly. Prices and availability can change on Amazon.",
    badges: ["Best Overall", "Best Budget", "Best Space Saving"],
    summaries: [
      "The best overall standing desk choice for most apartment remote workers who need reliable sit-stand flexibility.",
      "The best entry-level standing desk for users who want sit-stand benefits without a premium price.",
      "The best compact standing desk option for very small apartments and tight workspace corners.",
    ],
    relatedCount: 3,
    relatedTitles: [
      "Best Small Desks for Apartments in 2026",
      "FlexiSpot Compact Standing Desk Review",
      "Standing Desk vs Writing Desk",
    ],
    relatedHrefs: [
      "/blog/best-small-desks-apartments-2026",
      "/blog/flexispot-compact-standing-desk-review",
      "/blog/standing-desk-vs-writing-desk",
    ],
    coverImage: "/images/articles/best-standing-desks-small-apartments.jpg",
    intro:
      "If your desk has to share a room with a bed or sofa, footprint and stability matter more than flashy features.",
    category: "desks",
  },
  {
    batch: 2,
    slug: "ergonomic-chairs-small-rooms",
    title: "Ergonomic Chairs for Small Rooms Without the Bulky Look",
    type: "guide",
    description:
      "How to pick a supportive chair that fits under a compact desk and still looks right in a living space.",
    productIds: [],
    faqCount: 0,
    faqQuestions: [],
    featured: true,
    publishedAt: "2026-08-05",
    category: "chairs",
    tags: ["ergonomics", "office chair", "small space"],
  },
  {
    batch: 2,
    slug: "monitor-arms-small-desks",
    title: "Monitor Arms and Risers That Save a Tiny Desk",
    type: "guide",
    description:
      "Clamp mounts, single arms, and budget risers compared for apartment desks with limited surface area.",
    productIds: [],
    faqCount: 0,
    faqQuestions: [],
    featured: true,
    publishedAt: "2026-07-28",
    category: "monitors",
    tags: ["monitor arm", "desk space", "ergonomics"],
  },
  {
    batch: 2,
    slug: "cable-management-apartment-desk",
    title: "Cable Management for Apartment Desks in Under an Hour",
    type: "guide",
    description:
      "A simple under-desk tray method that hides power bricks and keeps floors clear in shared living spaces.",
    productIds: [],
    faqCount: 0,
    faqQuestions: [],
    featured: false,
    publishedAt: "2026-07-18",
    category: "storage",
    tags: ["cables", "organization", "quick wins"],
  },
];

function fail(message: string): never {
  console.error(`[migration-batch] ${message}`);
  process.exit(1);
}

function assertEqual(
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    fail(`${label}: expected ${e}, got ${a}`);
  }
}

clearProductCache();
clearArticleCache();

const manifest1 = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "content/migrations/article-v1-batch-1.json"),
    "utf8",
  ),
) as { articles: Array<{ slug: string }> };
const manifest2 = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "content/migrations/article-v1-batch-2.json"),
    "utf8",
  ),
) as { articles: Array<{ slug: string }> };

assertEqual(
  "batch-1 manifest slugs",
  manifest1.articles.map((a) => a.slug),
  SNAPSHOTS.filter((s) => s.batch === 1).map((s) => s.slug),
);
assertEqual(
  "batch-2 manifest slugs",
  manifest2.articles.map((a) => a.slug),
  SNAPSHOTS.filter((s) => s.batch === 2).map((s) => s.slug),
);

for (const snapshot of SNAPSHOTS) {
  const article = getResolvedArticleSync(snapshot.slug);

  assertEqual(`${snapshot.slug} title`, article.title, snapshot.title);
  assertEqual(`${snapshot.slug} type`, article.type, snapshot.type);
  assertEqual(`${snapshot.slug} slug`, article.slug, snapshot.slug);
  assertEqual(
    `${snapshot.slug} description`,
    article.description,
    snapshot.description,
  );
  assertEqual(
    `${snapshot.slug} productIds`,
    article.productIds,
    snapshot.productIds,
  );
  assertEqual(
    `${snapshot.slug} product order`,
    article.productRefs.map((ref) => ref.id),
    snapshot.productIds,
  );

  if (snapshot.winnerId !== undefined) {
    assertEqual(`${snapshot.slug} winnerId`, article.winnerId, snapshot.winnerId);
  }
  if (snapshot.winnerReason !== undefined) {
    assertEqual(
      `${snapshot.slug} winnerReason`,
      article.winnerReason,
      snapshot.winnerReason,
    );
  }

  assertEqual(`${snapshot.slug} faq count`, article.faq.length, snapshot.faqCount);
  assertEqual(
    `${snapshot.slug} faq questions`,
    article.faq.map((item) => item.question),
    snapshot.faqQuestions,
  );
  if (snapshot.faqAnswers) {
    assertEqual(
      `${snapshot.slug} faq answers`,
      article.faq.map((item) => item.answer),
      snapshot.faqAnswers,
    );
    if (snapshot.faqCount > 0) {
      const jsonLd = buildArticleJsonLd(article);
      const graph =
        (jsonLd as { "@graph"?: Array<Record<string, unknown>> })["@graph"] ?? [];
      const faqNode = graph.find((node) => node["@type"] === "FAQPage");
      if (!faqNode) fail(`${snapshot.slug}: FAQPage JSON-LD missing`);
      const entities = faqNode.mainEntity as Array<{ name?: string }>;
      assertEqual(
        `${snapshot.slug} FAQPage questions`,
        entities.map((item) => item.name),
        snapshot.faqQuestions,
      );
    }
  }

  if (snapshot.ratingCategoryLabels) {
    assertEqual(
      `${snapshot.slug} rating labels`,
      (article.ratingCategories ?? []).map((item) => item.label),
      snapshot.ratingCategoryLabels,
    );
    assertEqual(
      `${snapshot.slug} rating scores`,
      (article.ratingCategories ?? []).map((item) => item.score),
      snapshot.ratingCategoryScores,
    );
  }

  if (snapshot.comparisonRowFeatures) {
    assertEqual(
      `${snapshot.slug} comparison features`,
      (article.comparisonRows ?? []).map((row) => row.feature),
      snapshot.comparisonRowFeatures,
    );
    assertEqual(
      `${snapshot.slug} comparison values`,
      (article.comparisonRows ?? []).map((row) => row.values),
      snapshot.comparisonRowValues,
    );
  }

  assertEqual(`${snapshot.slug} featured`, article.featured, snapshot.featured);
  assertEqual(`${snapshot.slug} date`, article.date, snapshot.publishedAt);
  if (snapshot.updatedAt !== undefined) {
    assertEqual(`${snapshot.slug} updated`, article.updated, snapshot.updatedAt);
  }
  if (snapshot.author !== undefined) {
    assertEqual(`${snapshot.slug} author`, article.author, snapshot.author);
  }
  if (snapshot.methodology !== undefined) {
    assertEqual(
      `${snapshot.slug} methodology`,
      article.methodology,
      snapshot.methodology,
    );
  }
  if (snapshot.badges) {
    assertEqual(
      `${snapshot.slug} badges`,
      article.productRefs.map((ref) => ref.badge),
      snapshot.badges,
    );
  }
  if (snapshot.summaries) {
    assertEqual(
      `${snapshot.slug} summaries`,
      article.productRefs.map((ref) => ref.summary),
      snapshot.summaries,
    );
  }
  if (snapshot.verdict !== undefined) {
    assertEqual(
      `${snapshot.slug} verdict`,
      article.productRefs[0]?.verdict,
      snapshot.verdict,
    );
    assertEqual(
      `${snapshot.slug} resolved verdict`,
      article.resolvedProduct?.verdict,
      snapshot.verdict,
    );
  }
  if (snapshot.relatedCount !== undefined) {
    assertEqual(
      `${snapshot.slug} related count`,
      article.related?.length ?? 0,
      snapshot.relatedCount,
    );
  }
  if (snapshot.relatedTitles) {
    assertEqual(
      `${snapshot.slug} related titles`,
      (article.related ?? []).map((link) => link.title),
      snapshot.relatedTitles,
    );
  }
  if (snapshot.relatedHrefs) {
    assertEqual(
      `${snapshot.slug} related hrefs`,
      (article.related ?? []).map((link) => link.href),
      snapshot.relatedHrefs,
    );
  }
  if (snapshot.coverImage !== undefined) {
    assertEqual(
      `${snapshot.slug} coverImage`,
      article.coverImage,
      snapshot.coverImage,
    );
  }
  if (snapshot.intro !== undefined) {
    assertEqual(`${snapshot.slug} intro`, article.intro, snapshot.intro);
  }
  if (snapshot.category !== undefined) {
    assertEqual(`${snapshot.slug} category`, article.category, snapshot.category);
  }
  if (snapshot.tags) {
    assertEqual(`${snapshot.slug} tags`, article.tags, snapshot.tags);
  }

  const md = fs.readFileSync(
    path.join(process.cwd(), "content/posts", `${snapshot.slug}.md`),
    "utf8",
  );
  if (!/^---\r?\nschemaVersion:\s*1\r?\n/.test(md)) {
    fail(`${snapshot.slug}: missing V1 pointer frontmatter`);
  }

  console.log(
    `[migration-batch] PASS batch ${snapshot.batch} ${snapshot.slug} (${snapshot.type})`,
  );
}

const routes = getArticleSlugsSync().sort();
assertEqual("public routes", routes, EXPECTED_ROUTES);
console.log(`[migration-batch] PASS route set unchanged (${routes.length})`);

const featured = getFeaturedArticlesSync()
  .map((article) => article.slug)
  .sort();
assertEqual("featured article set", featured, EXPECTED_FEATURED);
console.log(
  `[migration-batch] PASS featured set unchanged (${featured.length})`,
);

const productsDir = path.join(process.cwd(), "content/products");
let productV1 = 0;
for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
  const parsed = JSON.parse(
    fs.readFileSync(path.join(productsDir, fileName), "utf8"),
  );
  if (isProductV1Document(parsed)) productV1 += 1;
}
if (productV1 !== 13) {
  fail(`Product V1 count expected 13, got ${productV1}`);
}
console.log("[migration-batch] PASS Product V1 count (13)");

const articleDataDir = path.join(process.cwd(), "content/article-data");
let publishedV1 = 0;
for (const fileName of fs.readdirSync(articleDataDir).filter((f) => f.endsWith(".json"))) {
  const parsed = JSON.parse(
    fs.readFileSync(path.join(articleDataDir, fileName), "utf8"),
  ) as { publishing?: { status?: string } };
  if (parsed.publishing?.status === "published") publishedV1 += 1;
}
if (publishedV1 !== 12) {
  fail(`Published Article V1 count expected 12, got ${publishedV1}`);
}
console.log("[migration-batch] PASS Published Article V1 count (12)");

// Zero production legacy articles remaining; loader path still exists in articles.ts
const postsDir = path.join(process.cwd(), "content/posts");
let legacyCount = 0;
for (const fileName of fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"))) {
  const raw = fs.readFileSync(path.join(postsDir, fileName), "utf8");
  if (!/^---\r?\nschemaVersion:\s*1\r?\n/.test(raw)) legacyCount += 1;
}
if (legacyCount !== 0) {
  fail(`Expected 0 legacy production articles, got ${legacyCount}`);
}
console.log("[migration-batch] PASS legacy production count (0)");

console.log("[migration-batch] Batch 1 + Batch 2 parity passed");

