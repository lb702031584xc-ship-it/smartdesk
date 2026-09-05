/**
 * Content Commerce Graph resolver (Phase 28–30).
 *
 * Read-only. Connects ArticleV1 ↔ ProductV1 ↔ Topic without mutating records.
 *
 * Phase 30: ContentGraphViewModel queries, topic lookups, read-only
 * InternalLinkSuggestion, SEO relationship signals, corpus report.
 *
 * Editorial link-opportunity tooling remains in `@/lib/editorial/content-graph`.
 */
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type {
  ArticleContentGraphView,
  ContentGraph,
  ContentGraphArticleRef,
  ContentGraphEdge,
  ContentGraphIntegrityIssue,
  ContentGraphIntegrityResult,
  ContentGraphNode,
  ContentGraphProductRef,
  ContentGraphReport,
  ContentGraphSeoSignals,
  ContentGraphViewModel,
  InternalLinkSuggestion,
  InternalLinkSuggestionItem,
  TopicCluster,
} from "@/types/content-graph";
import { resolveArticleWithProducts } from "@/lib/article-products";
import { getArticleV1, listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { validateArticleV1 } from "@/lib/article-schema";

function articleMap(articles: ArticleV1[]): Map<string, ArticleV1> {
  return new Map(articles.map((a) => [a.identity.id, a]));
}

function productMap(products: ProductV1Document[]): Map<string, ProductV1Document> {
  return new Map(products.map((p) => [p.id, p]));
}

function slugToArticleId(articles: ArticleV1[]): Map<string, string> {
  return new Map(articles.map((a) => [a.identity.slug, a.identity.id]));
}

function toArticleRef(article: ArticleV1): ContentGraphArticleRef {
  return {
    articleId: article.identity.id,
    slug: article.identity.slug,
    title: article.identity.title,
    type: article.classification.type,
    status: article.publishing.status,
  };
}

function toProductRef(product: ProductV1Document): ContentGraphProductRef {
  return {
    productId: product.id,
    name: product.identity.name,
    category: product.identity.category,
  };
}

function productIdsOf(article: ArticleV1): string[] {
  return (article.products?.primary ?? []).map((r) => r.productId);
}

function sharedProductIds(a: ArticleV1, b: ArticleV1): string[] {
  const set = new Set(productIdsOf(a));
  return productIdsOf(b).filter((id) => set.has(id));
}

/**
 * Resolve topicId for an article: explicit parentTopic, else classification.category.
 */
export function resolveArticleTopicId(article: ArticleV1): string | undefined {
  const parent = article.relationships?.parentTopic?.trim();
  if (parent) return parent;
  const category = article.classification.category?.trim();
  return category || undefined;
}

/**
 * Build topic clusters from the article corpus (structure only — no AI).
 */
export function buildTopicClusters(articles: ArticleV1[]): Map<string, TopicCluster> {
  const topics = new Map<string, TopicCluster>();

  for (const article of articles) {
    const topicId = resolveArticleTopicId(article);
    if (!topicId) continue;

    let cluster = topics.get(topicId);
    if (!cluster) {
      cluster = { topicId, articleIds: [], productIds: [] };
      topics.set(topicId, cluster);
    }

    if (!cluster.articleIds.includes(article.identity.id)) {
      cluster.articleIds.push(article.identity.id);
    }

    for (const ref of article.products?.primary ?? []) {
      if (!cluster.productIds.includes(ref.productId)) {
        cluster.productIds.push(ref.productId);
      }
    }
  }

  return topics;
}

/**
 * Collect typed edges for the corpus (derived + declared relationships).
 */
export function collectContentGraphEdges(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraphEdge[] {
  const edges: ContentGraphEdge[] = [];

  for (const article of articles) {
    const articleId = article.identity.id;
    const topicId = resolveArticleTopicId(article);

    if (topicId) {
      edges.push({
        type: "ARTICLE_BELONGS_TO_TOPIC",
        fromId: articleId,
        toId: topicId,
        source: "article.relationships.parentTopic",
      });
    }

    for (const ref of article.products?.primary ?? []) {
      edges.push({
        type: "ARTICLE_REFERENCES_PRODUCT",
        fromId: articleId,
        toId: ref.productId,
        source: "article.products",
      });
      edges.push({
        type: "PRODUCT_FEATURED_IN_ARTICLE",
        fromId: ref.productId,
        toId: articleId,
        source: "derived",
      });
    }

    for (const relatedId of article.relationships?.relatedArticles ?? []) {
      edges.push({
        type: "ARTICLE_RELATED_TO_ARTICLE",
        fromId: articleId,
        toId: relatedId,
        source: "article.relationships.relatedArticles",
      });
    }
  }

  for (const product of products) {
    for (const relatedId of product.relationships?.relatedProducts ?? []) {
      edges.push({
        type: "PRODUCT_RELATED_TO_PRODUCT",
        fromId: product.id,
        toId: relatedId,
        source: "product.relationships.relatedProducts",
      });
    }
  }

  return edges;
}

/**
 * Full Content Commerce Graph index (read-only).
 */
export function buildContentGraph(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraph {
  const nodes = new Map<string, ContentGraphNode>();
  const topics = buildTopicClusters(articles);
  const edges = collectContentGraphEdges(articles, products);

  for (const product of products) {
    nodes.set(`product:${product.id}`, {
      kind: "product",
      id: product.id,
      label: product.identity.name,
      category: product.identity.category,
    });
  }

  for (const article of articles) {
    nodes.set(`article:${article.identity.id}`, {
      kind: "article",
      id: article.identity.id,
      label: article.identity.title,
      category: article.classification.category,
      articleType: article.classification.type,
    });
  }

  for (const topic of topics.values()) {
    nodes.set(`topic:${topic.topicId}`, {
      kind: "topic",
      id: topic.topicId,
      label: topic.topicId,
    });
  }

  return {
    nodes,
    edges,
    topics,
    articleIds: articles.map((a) => a.identity.id),
    productIds: products.map((p) => p.id),
  };
}

/**
 * Per-article resolver view:
 * { article, products, relatedArticles, topic }
 */
export function resolveArticleContentGraph(
  article: ArticleV1,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ArticleContentGraphView {
  const byId = articleMap(articles);
  const byProduct = productMap(products);
  const topics = buildTopicClusters(articles);

  const joined = resolveArticleWithProducts(article, (id) => byProduct.get(id));
  const relatedIds = article.relationships?.relatedArticles ?? [];
  const relatedArticles = relatedIds
    .map((id) => byId.get(id))
    .filter((a): a is ArticleV1 => Boolean(a));

  const topicId = resolveArticleTopicId(article);
  const topic = topicId ? topics.get(topicId) ?? null : null;

  const edges = collectContentGraphEdges([article], products).filter((edge) => {
    if (edge.fromId === article.identity.id || edge.toId === article.identity.id) {
      return true;
    }
    // Include product-related edges for featured products
    return joined.products.some(
      (p) => edge.fromId === p.id || edge.toId === p.id,
    );
  });

  return {
    article,
    products: joined.products,
    relatedArticles,
    topic,
    edges,
  };
}

/**
 * Articles that feature a given product (inverse of ARTICLE_REFERENCES_PRODUCT).
 */
export function findArticlesForProduct(
  productId: string,
  articles: ArticleV1[],
): ArticleV1[] {
  return articles.filter((article) =>
    (article.products?.primary ?? []).some((ref) => ref.productId === productId),
  );
}

/**
 * Content gap signals: products with zero article references (incomplete, not false).
 */
export function findUnreferencedProducts(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ProductV1Document[] {
  const referenced = new Set<string>();
  for (const article of articles) {
    for (const ref of article.products?.primary ?? []) {
      referenced.add(ref.productId);
    }
  }
  return products.filter((p) => !referenced.has(p.id));
}

/**
 * Topics with fewer than `minArticles` articles (structure gap).
 */
export function findSparseTopics(
  topics: Map<string, TopicCluster>,
  minArticles = 2,
): TopicCluster[] {
  return [...topics.values()].filter((t) => t.articleIds.length < minArticles);
}

/** Topic query: articles in a topic cluster. */
export function getTopicArticles(
  topicId: string,
  articles: ArticleV1[],
): ArticleV1[] {
  const topics = buildTopicClusters(articles);
  const cluster = topics.get(topicId);
  if (!cluster) return [];
  const byId = articleMap(articles);
  return cluster.articleIds
    .map((id) => byId.get(id))
    .filter((a): a is ArticleV1 => Boolean(a));
}

/** Topic query: products appearing in a topic cluster. */
export function getTopicProducts(
  topicId: string,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ProductV1Document[] {
  const topics = buildTopicClusters(articles);
  const cluster = topics.get(topicId);
  if (!cluster) return [];
  const byId = productMap(products);
  return cluster.productIds
    .map((id) => byId.get(id))
    .filter((p): p is ProductV1Document => Boolean(p));
}

/**
 * Products that match a topic token but are not yet featured in that cluster.
 * Structural heuristic only — not AI.
 */
export function findProductsMissingFromTopic(
  topicId: string,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ProductV1Document[] {
  const topics = buildTopicClusters(articles);
  const cluster = topics.get(topicId);
  const inTopic = new Set(cluster?.productIds ?? []);
  return products.filter((p) => {
    if (inTopic.has(p.id)) return false;
    const category = p.identity.category;
    const sub = p.classification?.subcategory ?? "";
    return (
      topicId === category ||
      topicId.includes(category) ||
      category.includes(topicId) ||
      sub === topicId ||
      (sub.length > 0 && topicId.includes(sub))
    );
  });
}

/**
 * Read-only internal link suggestions (recommendation data only).
 * Does not modify Markdown or inject links.
 */
export function buildInternalLinkSuggestions(
  source: ArticleV1,
  articles: ArticleV1[],
): InternalLinkSuggestion {
  const existingRelated = new Set(source.relationships?.relatedArticles ?? []);
  const existingLinkSlugs = new Set(
    (source.relationships?.relatedLinks ?? [])
      .filter((l) => l.href.startsWith("/blog/"))
      .map((l) => l.href.replace(/^\/blog\//, "").split(/[?#]/)[0] ?? ""),
  );

  const suggestions: InternalLinkSuggestionItem[] = [];
  const sourceTopic = resolveArticleTopicId(source);

  for (const target of articles) {
    if (target.identity.id === source.identity.id) continue;
    if (target.publishing.status !== "published") continue;
    if (existingRelated.has(target.identity.id)) continue;
    if (existingLinkSlugs.has(target.identity.slug)) continue;

    const shared = sharedProductIds(source, target);
    const reasons: string[] = [];

    if (shared.length > 0) {
      reasons.push(`same product relationship (${shared.join(", ")})`);
    }

    const targetTopic = resolveArticleTopicId(target);
    if (sourceTopic && targetTopic && sourceTopic === targetTopic) {
      reasons.push(`same topic (${sourceTopic})`);
    }

    if (
      source.classification.category &&
      target.classification.category &&
      source.classification.category === target.classification.category &&
      reasons.length === 0
    ) {
      reasons.push(`same category (${source.classification.category})`);
    }

    if (reasons.length === 0) continue;

    suggestions.push({
      articleId: target.identity.id,
      slug: target.identity.slug,
      title: target.identity.title,
      reason: reasons[0]!,
    });
  }

  suggestions.sort((a, b) => {
    const aScore = a.reason.startsWith("same product") ? 0 : 1;
    const bScore = b.reason.startsWith("same product") ? 0 : 1;
    return aScore - bScore;
  });

  return {
    sourceArticle: source.identity.id,
    suggestedArticles: suggestions.slice(0, 10),
  };
}

function computeIncoming(article: ArticleV1, articles: ArticleV1[]): ArticleV1[] {
  const articleId = article.identity.id;
  const productSet = new Set(productIdsOf(article));
  const incoming: ArticleV1[] = [];

  for (const other of articles) {
    if (other.identity.id === articleId) continue;
    const declaresRelated = (other.relationships?.relatedArticles ?? []).includes(
      articleId,
    );
    const sharesProduct = productIdsOf(other).some((id) => productSet.has(id));
    if (declaresRelated || sharesProduct) incoming.push(other);
  }
  return incoming;
}

function computeOutgoing(article: ArticleV1, articles: ArticleV1[]): ArticleV1[] {
  const byId = articleMap(articles);
  const seen = new Set<string>();
  const outgoing: ArticleV1[] = [];

  for (const id of article.relationships?.relatedArticles ?? []) {
    const related = byId.get(id);
    if (related && !seen.has(related.identity.id)) {
      seen.add(related.identity.id);
      outgoing.push(related);
    }
  }

  for (const other of articles) {
    if (other.identity.id === article.identity.id) continue;
    if (seen.has(other.identity.id)) continue;
    if (sharedProductIds(article, other).length > 0) {
      seen.add(other.identity.id);
      outgoing.push(other);
    }
  }

  return outgoing;
}

/**
 * SEO relationship signals for dashboards (not ranking manipulation).
 */
export function buildContentGraphSeoSignals(
  article: ArticleV1,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraphSeoSignals {
  const topics = buildTopicClusters(articles);
  const topicId = resolveArticleTopicId(article);
  const topic = topicId ? topics.get(topicId) ?? null : null;
  const incoming = computeIncoming(article, articles);
  const relatedCount = (article.relationships?.relatedArticles ?? []).length;
  const productCoverage = productIdsOf(article).filter((id) =>
    products.some((p) => p.id === id),
  ).length;

  let orphanStatus: ContentGraphSeoSignals["orphanStatus"] = "connected";
  if (incoming.length === 0 && relatedCount === 0) {
    orphanStatus = topic && topic.articleIds.length <= 1 ? "isolated-topic" : "orphan";
  }

  return {
    topicDepth: topic?.articleIds.length ?? 0,
    relatedArticleCount: relatedCount,
    productCoverage,
    orphanStatus,
    incomingCount: incoming.length,
    outgoingCount: computeOutgoing(article, articles).length,
    hasProducts: productCoverage > 0,
    hasTopic: Boolean(topicId),
  };
}

/**
 * Phase 30 — ContentGraphViewModel for one article (read-only).
 */
export function resolveContentGraphViewModel(
  article: ArticleV1,
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraphViewModel {
  const structural = validateArticleV1(article);
  if (!structural.valid) {
    throw new Error(
      `[content-graph] Invalid Article V1 (${article.identity?.id ?? "unknown"}):\n- ${structural.errors.join("\n- ")}`,
    );
  }

  const view = resolveArticleContentGraph(article, articles, products);
  const incoming = computeIncoming(article, articles);
  const outgoing = computeOutgoing(article, articles);

  return {
    articleId: article.identity.id,
    slug: article.identity.slug,
    title: article.identity.title,
    topic: view.topic,
    products: view.products.map(toProductRef),
    relatedArticles: view.relatedArticles.map(toArticleRef),
    incomingReferences: incoming.map(toArticleRef),
    outgoingReferences: outgoing.map(toArticleRef),
    seoSignals: buildContentGraphSeoSignals(article, articles, products),
    linkSuggestions: buildInternalLinkSuggestions(article, articles),
  };
}

/**
 * Resolve ViewModel by article identity.id from the active content store.
 */
export async function resolveContentGraphViewModelById(
  articleId: string,
): Promise<ContentGraphViewModel> {
  const articles = await listArticlesV1();
  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();

  const article =
    articles.find((a) => a.identity.id === articleId) ??
    (await getArticleV1(articleId))?.article;

  if (!article) {
    throw new Error(`[content-graph] Article not found: ${articleId}`);
  }

  return resolveContentGraphViewModel(article, articles, products);
}

/**
 * Corpus informational report (no mutations).
 */
export function buildContentGraphReport(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraphReport {
  const topics = buildTopicClusters(articles);
  const integrity = validateContentGraphIntegrity(articles, products);

  const orphanArticles: ContentGraphArticleRef[] = [];
  const articlesWithoutProducts: ContentGraphArticleRef[] = [];

  for (const a of articles) {
    if (a.publishing.status !== "published") continue;
    const incoming = computeIncoming(a, articles);
    const relatedOut = (a.relationships?.relatedArticles ?? []).length;
    const relatedIn = articles.filter((other) =>
      (other.relationships?.relatedArticles ?? []).includes(a.identity.id),
    );
    if (incoming.length === 0 && relatedOut === 0 && relatedIn.length === 0) {
      orphanArticles.push(toArticleRef(a));
    }
    if (productIdsOf(a).length === 0) {
      articlesWithoutProducts.push(toArticleRef(a));
    }
  }

  return {
    articleCount: articles.length,
    productCount: products.length,
    topicCount: topics.size,
    orphanArticles,
    articlesWithoutProducts,
    productsWithoutArticles: findUnreferencedProducts(articles, products).map(
      toProductRef,
    ),
    sparseTopics: findSparseTopics(topics, 2),
    integrity,
  };
}

/**
 * Integrity validation for declared relationships.
 * Does not fail on missing optional relatedArticles in production unless they are declared.
 */
export function validateContentGraphIntegrity(
  articles: ArticleV1[],
  products: ProductV1Document[],
): ContentGraphIntegrityResult {
  const errors: ContentGraphIntegrityIssue[] = [];
  const warnings: ContentGraphIntegrityIssue[] = [];
  const articleIds = new Set(articles.map((a) => a.identity.id));
  const productIds = new Set(products.map((p) => p.id));
  const seenEdges = new Set<string>();

  const push = (issue: ContentGraphIntegrityIssue) => {
    if (issue.severity === "error") errors.push(issue);
    else warnings.push(issue);
  };

  for (const article of articles) {
    const articleId = article.identity.id;

    // Product refs — ownership: products live under article.products only
    for (const ref of article.products?.primary ?? []) {
      if (ref.productId === articleId) {
        push({
          severity: "error",
          code: "self-reference",
          message: `Article "${articleId}" product ref equals article id.`,
          fromId: articleId,
          toId: ref.productId,
        });
      }
      if (!productIds.has(ref.productId)) {
        push({
          severity: "error",
          code: "missing-product",
          message: `Article "${articleId}" references missing product "${ref.productId}".`,
          fromId: articleId,
          toId: ref.productId,
        });
      }
      const key = `ARTICLE_REFERENCES_PRODUCT|${articleId}|${ref.productId}`;
      if (seenEdges.has(key)) {
        push({
          severity: "error",
          code: "duplicate-edge",
          message: `Duplicate product ref "${ref.productId}" on article "${articleId}".`,
          fromId: articleId,
          toId: ref.productId,
        });
      }
      seenEdges.add(key);
    }

    // relatedArticles — article-owned content relationships
    const related = article.relationships?.relatedArticles ?? [];
    const relatedSeen = new Set<string>();
    for (const relatedId of related) {
      if (relatedId === articleId) {
        push({
          severity: "error",
          code: "self-reference",
          message: `Article "${articleId}" relatedArticles includes self.`,
          fromId: articleId,
          toId: relatedId,
        });
      }
      if (relatedSeen.has(relatedId)) {
        push({
          severity: "error",
          code: "duplicate-edge",
          message: `Duplicate relatedArticles entry "${relatedId}" on "${articleId}".`,
          fromId: articleId,
          toId: relatedId,
        });
      }
      relatedSeen.add(relatedId);
      if (!articleIds.has(relatedId)) {
        // relatedArticles may be empty in production; declared broken IDs are errors
        push({
          severity: "error",
          code: "missing-article",
          message: `Article "${articleId}" relatedArticles references missing article "${relatedId}".`,
          fromId: articleId,
          toId: relatedId,
        });
      }
    }

    // Ownership: products must not appear under relationships
    const rel = article.relationships as Record<string, unknown> | undefined;
    if (rel && ("products" in rel || "primary" in rel || "productIds" in rel)) {
      push({
        severity: "error",
        code: "ownership-violation",
        message: `Article "${articleId}" relationships must not own product lists; use article.products.`,
        fromId: articleId,
      });
    }
  }

  // Mutual relatedArticles are allowed; advisory warning only (not an integrity failure).
  for (const article of articles) {
    const articleId = article.identity.id;
    for (const relatedId of article.relationships?.relatedArticles ?? []) {
      const other = articles.find((a) => a.identity.id === relatedId);
      if (!other) continue;
      const back = (other.relationships?.relatedArticles ?? []).includes(articleId);
      if (back && articleId < relatedId) {
        push({
          severity: "warning",
          code: "circular-reference",
          message: `Mutual relatedArticles between "${articleId}" and "${relatedId}" (allowed; advisory).`,
          fromId: articleId,
          toId: relatedId,
        });
      }
    }
  }

  for (const product of products) {
    const related = product.relationships?.relatedProducts ?? [];
    const relatedSeen = new Set<string>();
    for (const relatedId of related) {
      if (relatedId === product.id) {
        push({
          severity: "error",
          code: "self-reference",
          message: `Product "${product.id}" relatedProducts includes self.`,
          fromId: product.id,
          toId: relatedId,
        });
      }
      if (relatedSeen.has(relatedId)) {
        push({
          severity: "error",
          code: "duplicate-edge",
          message: `Duplicate relatedProducts entry "${relatedId}" on "${product.id}".`,
          fromId: product.id,
          toId: relatedId,
        });
      }
      relatedSeen.add(relatedId);
      if (!productIds.has(relatedId)) {
        push({
          severity: "error",
          code: "missing-product",
          message: `Product "${product.id}" relatedProducts references missing product "${relatedId}".`,
          fromId: product.id,
          toId: relatedId,
        });
      }
    }
  }

  // relatedLinks slug check (warnings — href-based, not ID graph)
  const slugs = slugToArticleId(articles);
  for (const article of articles) {
    for (const link of article.relationships?.relatedLinks ?? []) {
      if (!link.href.startsWith("/blog/")) continue;
      const slug = link.href.replace(/^\/blog\//, "").split(/[?#]/)[0] ?? "";
      if (slug && !slugs.has(slug)) {
        push({
          severity: "warning",
          code: "missing-article",
          message: `Article "${article.identity.id}" relatedLinks href "/blog/${slug}" has no matching article slug.`,
          fromId: article.identity.id,
          toId: slug,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export type {
  ArticleContentGraphView,
  ContentGraph,
  ContentGraphArticleRef,
  ContentGraphEdge,
  ContentGraphIntegrityIssue,
  ContentGraphIntegrityResult,
  ContentGraphNode,
  ContentGraphNodeKind,
  ContentGraphProductRef,
  ContentGraphRelationshipType,
  ContentGraphReport,
  ContentGraphSeoSignals,
  ContentGraphViewModel,
  InternalLinkSuggestion,
  InternalLinkSuggestionItem,
  TopicCluster,
} from "@/types/content-graph";
