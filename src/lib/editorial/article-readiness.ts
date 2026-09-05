import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type ReadinessSeverity = "blocker" | "warning" | "pass" | "info";

export type ReadinessCheck = {
  id: string;
  label: string;
  severity: ReadinessSeverity;
  message: string;
  section?: string;
};

export type ArticleReadinessResult = {
  ready: boolean;
  blockers: ReadinessCheck[];
  warnings: ReadinessCheck[];
  checks: ReadinessCheck[];
};

const VERIFICATION_MARKER = "[needs verification]";

function containsMarker(text: string | undefined): boolean {
  return typeof text === "string" && text.toLowerCase().includes(VERIFICATION_MARKER);
}

function hasPlaceholder(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    containsMarker(text) ||
    /\btodo\b/i.test(lower) ||
    /\btbd\b/i.test(lower) ||
    lower.includes("lorem ipsum")
  );
}

export function evaluateArticleReadiness(
  article: ArticleV1,
  body: string,
  products: ProductV1Document[],
  options?: { knownSlugs?: Set<string> },
): ArticleReadinessResult {
  const checks: ReadinessCheck[] = [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const type = article.classification.type;
  const primary = article.products?.primary ?? [];

  // --- Content ---

  if (body.trim()) {
    checks.push({ id: "body.present", label: "Body", severity: "pass", message: "Article body is present.", section: "Content" });
  } else {
    checks.push({ id: "body.present", label: "Body", severity: "blocker", message: "Article body is empty.", section: "Content" });
  }

  if (containsMarker(body)) {
    checks.push({ id: "body.needs-verification", label: "Verification marker in body", severity: "blocker", message: "Body contains [needs verification] — resolve before publishing.", section: "Content" });
  } else {
    checks.push({ id: "body.needs-verification", label: "Verification marker", severity: "pass", message: "No [needs verification] markers in body.", section: "Content" });
  }

  if (hasPlaceholder(body) && !containsMarker(body)) {
    checks.push({ id: "body.placeholder", label: "Placeholder text", severity: "warning", message: "Body may contain placeholder text (TODO/TBD/Lorem ipsum).", section: "Content" });
  }

  // Check verification markers in metadata fields
  const metaFields = [
    { field: "summary", value: article.editorial.summary },
    { field: "metaDescription", value: article.seo?.metaDescription },
    { field: "metaTitle", value: article.seo?.metaTitle },
  ];
  for (const { field, value } of metaFields) {
    if (containsMarker(value)) {
      checks.push({ id: `meta.${field}.needs-verification`, label: `${field} verification`, severity: "blocker", message: `${field} contains [needs verification].`, section: "Content" });
    }
  }

  // FAQ verification markers
  for (const [i, faq] of (article.faq ?? []).entries()) {
    if (containsMarker(faq.question) || containsMarker(faq.answer)) {
      checks.push({ id: `faq.${i}.needs-verification`, label: `FAQ ${i + 1} verification`, severity: "blocker", message: `FAQ item ${i + 1} contains [needs verification].`, section: "Content" });
    }
  }

  // ProductRef verification markers
  for (const ref of primary) {
    if (containsMarker(ref.summary) || containsMarker(ref.verdict) || containsMarker(ref.bestFor)) {
      checks.push({ id: `product-ref.${ref.productId}.needs-verification`, label: `Product ref ${ref.productId}`, severity: "blocker", message: `Product reference for ${ref.productId} contains [needs verification].`, section: "Content" });
    }
  }

  // Body structure
  if (body.trim() && body.trim().length > 500 && !body.includes("#")) {
    checks.push({ id: "body.headings", label: "Body structure", severity: "warning", message: "Long body with no Markdown headings.", section: "Content" });
  }

  // Word count info
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  checks.push({ id: "body.word-count", label: "Word count", severity: "info", message: `${wordCount} words.`, section: "Content" });

  // Summary
  if (!article.editorial.summary?.trim()) {
    checks.push({ id: "editorial.summary", label: "Summary", severity: "warning", message: "Article summary is empty.", section: "Content" });
  } else {
    checks.push({ id: "editorial.summary", label: "Summary", severity: "pass", message: "Summary present.", section: "Content" });
  }

  // --- SEO ---

  if (article.seo?.metaDescription?.trim()) {
    checks.push({ id: "seo.meta-description", label: "Meta description", severity: "pass", message: "Meta description present.", section: "SEO" });
  } else {
    checks.push({ id: "seo.meta-description", label: "Meta description", severity: "warning", message: "Meta description is empty — fallback will be used.", section: "SEO" });
  }

  if (article.seo?.metaTitle?.trim()) {
    checks.push({ id: "seo.meta-title", label: "Meta title", severity: "pass", message: "Custom meta title present.", section: "SEO" });
  } else {
    checks.push({ id: "seo.meta-title", label: "Meta title", severity: "info", message: "Using article title as SEO title.", section: "SEO" });
  }

  if (article.seo?.noindex && article.publishing.status === "published") {
    checks.push({ id: "seo.noindex", label: "noindex", severity: "warning", message: "Published article is configured noindex — it will not be indexed by search engines.", section: "SEO" });
  } else {
    checks.push({ id: "seo.noindex", label: "noindex", severity: "pass", message: "Indexing is enabled.", section: "SEO" });
  }

  // --- Products ---

  for (const ref of primary) {
    if (productMap.has(ref.productId)) {
      checks.push({ id: `products.exists.${ref.productId}`, label: `Product ${ref.productId}`, severity: "pass", message: `Product ${ref.productId} exists.`, section: "Products" });
    } else {
      checks.push({ id: `products.exists.${ref.productId}`, label: `Product ${ref.productId}`, severity: "blocker", message: `Referenced product not found: ${ref.productId}.`, section: "Products" });
    }
  }

  // Duplicate product refs
  const seenIds = new Set<string>();
  for (const ref of primary) {
    if (seenIds.has(ref.productId)) {
      checks.push({ id: `products.duplicate.${ref.productId}`, label: `Duplicate ${ref.productId}`, severity: "blocker", message: `Duplicate product reference: ${ref.productId}.`, section: "Products" });
    }
    seenIds.add(ref.productId);
  }

  // Type-specific product checks
  if (type === "best-list") {
    if (primary.length < 1) {
      checks.push({ id: "template.best-list.min-products", label: "Best list products", severity: "blocker", message: "Best list requires at least one product.", section: "Products" });
    }
    const ranks = primary.map((r) => r.rank).filter((r): r is number => typeof r === "number");
    const seenRanks = new Set<number>();
    for (const rank of ranks) {
      if (seenRanks.has(rank)) {
        checks.push({ id: `template.best-list.duplicate-rank.${rank}`, label: `Duplicate rank ${rank}`, severity: "blocker", message: `Best list has duplicate rank: ${rank}.`, section: "Products" });
      }
      seenRanks.add(rank);
    }
  }

  if (type === "review") {
    if (primary.length !== 1) {
      checks.push({ id: "template.review.single-product", label: "Review product", severity: "blocker", message: "Review requires exactly one product.", section: "Products" });
    }
  }

  if (type === "comparison") {
    if (primary.length < 2) {
      checks.push({ id: "template.comparison.min-products", label: "Comparison products", severity: "blocker", message: "Comparison requires at least two products.", section: "Products" });
    }
    const winnerId = article.comparison?.winnerId ?? article.products?.winnerProductId;
    if (winnerId && !primary.some((r) => r.productId === winnerId)) {
      checks.push({ id: "template.comparison.winner-valid", label: "Winner", severity: "blocker", message: `Winner ${winnerId} is not in product references.`, section: "Products" });
    }
  }

  // Best-list product framing warnings
  if (type === "best-list") {
    for (const ref of primary) {
      if (!ref.summary && !ref.verdict && !ref.role) {
        checks.push({ id: `products.framing.${ref.productId}`, label: `Framing ${ref.productId}`, severity: "warning", message: `Product ${ref.productId} has no summary, verdict, or role.`, section: "Products" });
      }
    }
  }

  // --- Commerce ---

  if (article.commerce?.affiliateEnabled && !article.commerce?.disclosure) {
    checks.push({ id: "commerce.disclosure", label: "Affiliate disclosure", severity: "warning", message: "Affiliate enabled but disclosure is off.", section: "Commerce" });
  }

  // --- Publishing ---

  if (article.publishing.status === "scheduled") {
    if (!article.publishing.scheduledAt) {
      checks.push({ id: "publishing.scheduled-at", label: "Schedule time", severity: "blocker", message: "Scheduled articles require a future publish time.", section: "Publishing" });
    } else {
      const ts = new Date(article.publishing.scheduledAt).getTime();
      if (Number.isNaN(ts)) {
        checks.push({ id: "publishing.scheduled-at", label: "Schedule time", severity: "blocker", message: "Invalid scheduled publish time.", section: "Publishing" });
      } else if (ts <= Date.now()) {
        checks.push({ id: "publishing.scheduled-at", label: "Schedule time", severity: "blocker", message: "Scheduled time is in the past.", section: "Publishing" });
      } else {
        checks.push({ id: "publishing.scheduled-at", label: "Schedule time", severity: "pass", message: "Schedule time is valid and future.", section: "Publishing" });
      }
    }
  }

  // --- Internal links ---

  if (options?.knownSlugs) {
    const linkRe = /\[([^\]]*)\]\(\s*\/blog\/([a-z0-9][a-z0-9-]*[a-z0-9])\s*\)/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRe.exec(body)) !== null) {
      const slug = linkMatch[2];
      if (!options.knownSlugs.has(slug)) {
        checks.push({ id: `links.broken.${slug}`, label: `Broken link /blog/${slug}`, severity: "blocker", message: `Internal link to /blog/${slug} — article not found.`, section: "Content" });
      }
    }
    for (const link of article.relationships?.relatedLinks ?? []) {
      if (link.href.startsWith("/blog/")) {
        const slug = link.href.replace(/^\/blog\//, "");
        if (slug && !options.knownSlugs.has(slug)) {
          checks.push({ id: `links.broken-related.${slug}`, label: `Broken related link ${slug}`, severity: "blocker", message: `Related link to /blog/${slug} — article not found.`, section: "Content" });
        }
      }
    }
  }

  // --- Compute result ---

  const blockers = checks.filter((c) => c.severity === "blocker");
  const warnings = checks.filter((c) => c.severity === "warning");

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    checks,
  };
}
