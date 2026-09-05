import type { ArticleV1, ArticleV1Type } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleNode = {
  id: string;
  slug: string;
  title: string;
  type: ArticleV1Type;
  category?: string;
  intent: string;
  status: string;
  productIds: string[];
  outboundSlugs: string[];
  relatedArticleIds: string[];
  relatedLinkHrefs: string[];
};

export type ProductNode = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  referencingArticleIds: string[];
};

export type BrokenLink = {
  sourceArticleId: string;
  targetSlug: string;
  location: "body" | "relatedLinks";
};

export type InternalLinkOpportunity = {
  sourceArticleId: string;
  targetArticleId: string;
  reasons: string[];
  strength: "strong" | "medium" | "weak";
  sharedProductIds: string[];
};

export type ArticleLinkProfile = {
  articleId: string;
  outboundArticleIds: string[];
  inboundArticleIds: string[];
  productIds: string[];
  brokenLinks: BrokenLink[];
  opportunities: InternalLinkOpportunity[];
};

export type ContentGraph = {
  articles: Map<string, ArticleNode>;
  products: Map<string, ProductNode>;
  slugToId: Map<string, string>;
};

// ---------------------------------------------------------------------------
// Internal link extraction from Markdown body
// ---------------------------------------------------------------------------

const INTERNAL_LINK_RE = /\[([^\]]*)\]\(\s*\/blog\/([a-z0-9][a-z0-9-]*[a-z0-9])\s*\)/g;

export function extractBodyInternalSlugs(body: string): string[] {
  const slugs: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(INTERNAL_LINK_RE.source, INTERNAL_LINK_RE.flags);
  while ((match = re.exec(body)) !== null) {
    slugs.push(match[2]);
  }
  return [...new Set(slugs)];
}

// ---------------------------------------------------------------------------
// Build graph
// ---------------------------------------------------------------------------

export function buildContentGraph(
  articles: ArticleV1[],
  bodies: Map<string, string>,
  products: ProductV1Document[],
): ContentGraph {
  const slugToId = new Map<string, string>();
  const articleNodes = new Map<string, ArticleNode>();
  const productNodes = new Map<string, ProductNode>();

  for (const p of products) {
    productNodes.set(p.id, {
      id: p.id,
      name: p.identity.name,
      category: p.identity.category,
      subcategory: p.classification?.subcategory,
      referencingArticleIds: [],
    });
  }

  for (const a of articles) {
    slugToId.set(a.identity.slug, a.identity.id);
  }

  for (const a of articles) {
    const productIds = (a.products?.primary ?? []).map((r) => r.productId);
    const body = bodies.get(a.identity.id) ?? "";
    const outboundSlugs = extractBodyInternalSlugs(body);
    const relatedLinkHrefs = (a.relationships?.relatedLinks ?? [])
      .map((l) => l.href)
      .filter((h) => h.startsWith("/blog/"));

    articleNodes.set(a.identity.id, {
      id: a.identity.id,
      slug: a.identity.slug,
      title: a.identity.title,
      type: a.classification.type,
      category: a.classification.category,
      intent: a.editorial.intent,
      status: a.publishing.status,
      productIds,
      outboundSlugs,
      relatedArticleIds: a.relationships?.relatedArticles ?? [],
      relatedLinkHrefs,
    });

    for (const pid of productIds) {
      const pn = productNodes.get(pid);
      if (pn) pn.referencingArticleIds.push(a.identity.id);
    }
  }

  return { articles: articleNodes, products: productNodes, slugToId };
}

// ---------------------------------------------------------------------------
// Broken links
// ---------------------------------------------------------------------------

export function findBrokenInternalLinks(graph: ContentGraph): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const node of graph.articles.values()) {
    for (const slug of node.outboundSlugs) {
      if (!graph.slugToId.has(slug)) {
        broken.push({ sourceArticleId: node.id, targetSlug: slug, location: "body" });
      }
    }
    for (const href of node.relatedLinkHrefs) {
      const slug = href.replace(/^\/blog\//, "");
      if (!graph.slugToId.has(slug)) {
        broken.push({ sourceArticleId: node.id, targetSlug: slug, location: "relatedLinks" });
      }
    }
  }
  return broken;
}

// ---------------------------------------------------------------------------
// Link profile
// ---------------------------------------------------------------------------

function resolveOutboundIds(node: ArticleNode, slugToId: Map<string, string>): string[] {
  const ids = new Set<string>();
  for (const slug of node.outboundSlugs) {
    const id = slugToId.get(slug);
    if (id && id !== node.id) ids.add(id);
  }
  for (const href of node.relatedLinkHrefs) {
    const slug = href.replace(/^\/blog\//, "");
    const id = slugToId.get(slug);
    if (id && id !== node.id) ids.add(id);
  }
  for (const id of node.relatedArticleIds) {
    if (id !== node.id) ids.add(id);
  }
  return [...ids];
}

export function getArticleLinkProfile(
  articleId: string,
  graph: ContentGraph,
): ArticleLinkProfile {
  const node = graph.articles.get(articleId);
  if (!node) {
    return { articleId, outboundArticleIds: [], inboundArticleIds: [], productIds: [], brokenLinks: [], opportunities: [] };
  }

  const outboundArticleIds = resolveOutboundIds(node, graph.slugToId);

  const inboundArticleIds: string[] = [];
  for (const other of graph.articles.values()) {
    if (other.id === articleId) continue;
    const otherOutbound = resolveOutboundIds(other, graph.slugToId);
    if (otherOutbound.includes(articleId)) inboundArticleIds.push(other.id);
  }

  const brokenLinks = findBrokenInternalLinks(graph).filter(
    (b) => b.sourceArticleId === articleId,
  );

  const opportunities = findInternalLinkOpportunities(articleId, graph);

  return {
    articleId,
    outboundArticleIds,
    inboundArticleIds,
    productIds: node.productIds,
    brokenLinks,
    opportunities,
  };
}

// ---------------------------------------------------------------------------
// Opportunity detection
// ---------------------------------------------------------------------------

const COMPLEMENTARY_PAIRS: [ArticleV1Type, ArticleV1Type][] = [
  ["best-list", "review"],
  ["best-list", "comparison"],
  ["review", "comparison"],
  ["guide", "best-list"],
];

function isComplementary(a: ArticleV1Type, b: ArticleV1Type): boolean {
  return COMPLEMENTARY_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

function intentComplementary(a: string, b: string): boolean {
  return (
    (a === "informational" && b === "commercial") ||
    (a === "commercial" && b === "informational")
  );
}

export function findInternalLinkOpportunities(
  articleId: string,
  graph: ContentGraph,
): InternalLinkOpportunity[] {
  const source = graph.articles.get(articleId);
  if (!source) return [];

  const existingOutbound = new Set(resolveOutboundIds(source, graph.slugToId));
  const opportunities: InternalLinkOpportunity[] = [];

  for (const target of graph.articles.values()) {
    if (target.id === articleId) continue;
    if (target.status === "draft" || target.status === "review" || target.status === "archived" || target.status === "scheduled") continue;
    if (existingOutbound.has(target.id)) continue;

    const sharedProductIds = source.productIds.filter((pid) =>
      target.productIds.includes(pid),
    );
    const reasons: string[] = [];

    if (sharedProductIds.length > 0) {
      reasons.push(`Shared products: ${sharedProductIds.join(", ")}`);
    }

    if (isComplementary(source.type, target.type)) {
      reasons.push(`${source.type} ↔ ${target.type} relationship`);
    }

    if (
      source.category &&
      target.category &&
      source.category === target.category &&
      reasons.length === 0
    ) {
      reasons.push(`Same category: ${source.category}`);
    }

    if (intentComplementary(source.intent, target.intent) && reasons.length === 0) {
      reasons.push(`Intent complementary: ${source.intent} ↔ ${target.intent}`);
    }

    if (reasons.length === 0) continue;

    let strength: "strong" | "medium" | "weak";
    if (sharedProductIds.length > 0 && isComplementary(source.type, target.type)) {
      strength = "strong";
    } else if (sharedProductIds.length > 0) {
      strength = "medium";
    } else {
      strength = "weak";
    }

    opportunities.push({
      sourceArticleId: source.id,
      targetArticleId: target.id,
      reasons,
      strength,
      sharedProductIds,
    });
  }

  opportunities.sort((a, b) => {
    const order = { strong: 0, medium: 1, weak: 2 };
    return order[a.strength] - order[b.strength];
  });

  return opportunities.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Backlink opportunities (who should link TO this article)
// ---------------------------------------------------------------------------

export function findBacklinkOpportunities(
  articleId: string,
  graph: ContentGraph,
): InternalLinkOpportunity[] {
  const target = graph.articles.get(articleId);
  if (!target) return [];

  const results: InternalLinkOpportunity[] = [];

  for (const source of graph.articles.values()) {
    if (source.id === articleId) continue;
    if (source.status !== "published") continue;

    const existingOutbound = new Set(resolveOutboundIds(source, graph.slugToId));
    if (existingOutbound.has(articleId)) continue;

    const sharedProductIds = source.productIds.filter((pid) =>
      target.productIds.includes(pid),
    );
    const reasons: string[] = [];

    if (sharedProductIds.length > 0) {
      reasons.push(`Shared products: ${sharedProductIds.join(", ")}`);
    }
    if (isComplementary(source.type, target.type)) {
      reasons.push(`${source.type} ↔ ${target.type} relationship`);
    }
    if (source.category && target.category && source.category === target.category && reasons.length === 0) {
      reasons.push(`Same category: ${source.category}`);
    }

    if (reasons.length === 0) continue;

    let strength: "strong" | "medium" | "weak";
    if (sharedProductIds.length > 0 && isComplementary(source.type, target.type)) {
      strength = "strong";
    } else if (sharedProductIds.length > 0) {
      strength = "medium";
    } else {
      strength = "weak";
    }

    results.push({
      sourceArticleId: source.id,
      targetArticleId: articleId,
      reasons,
      strength,
      sharedProductIds,
    });
  }

  results.sort((a, b) => {
    const order = { strong: 0, medium: 1, weak: 2 };
    return order[a.strength] - order[b.strength];
  });

  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Graph-wide metrics
// ---------------------------------------------------------------------------

export type GraphOverview = {
  publishedCount: number;
  orphanCandidates: { id: string; title: string }[];
  deadEndCandidates: { id: string; title: string }[];
  brokenLinks: BrokenLink[];
  strongOpportunityCount: number;
  mediumOpportunityCount: number;
};

export function getGraphOverview(graph: ContentGraph): GraphOverview {
  const published = [...graph.articles.values()].filter((a) => a.status === "published");
  const inboundMap = new Map<string, number>();
  for (const a of published) inboundMap.set(a.id, 0);

  for (const a of published) {
    for (const outId of resolveOutboundIds(a, graph.slugToId)) {
      if (inboundMap.has(outId)) {
        inboundMap.set(outId, (inboundMap.get(outId) ?? 0) + 1);
      }
    }
  }

  const orphanCandidates = published
    .filter((a) => (inboundMap.get(a.id) ?? 0) === 0)
    .map((a) => ({ id: a.id, title: a.title }));

  const deadEndCandidates = published
    .filter((a) => resolveOutboundIds(a, graph.slugToId).length === 0)
    .map((a) => ({ id: a.id, title: a.title }));

  const brokenLinks = findBrokenInternalLinks(graph);

  let strongOpportunityCount = 0;
  let mediumOpportunityCount = 0;
  const seen = new Set<string>();
  for (const a of published) {
    for (const opp of findInternalLinkOpportunities(a.id, graph)) {
      const key = `${opp.sourceArticleId}->${opp.targetArticleId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (opp.strength === "strong") strongOpportunityCount++;
      else if (opp.strength === "medium") mediumOpportunityCount++;
    }
  }

  return {
    publishedCount: published.length,
    orphanCandidates,
    deadEndCandidates,
    brokenLinks,
    strongOpportunityCount,
    mediumOpportunityCount,
  };
}
