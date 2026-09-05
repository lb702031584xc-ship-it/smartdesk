/**
 * Editorial Activity resolver (Phase 37) — READ ONLY.
 *
 * Derives operational intelligence from:
 * - product/article revisions (before snapshots)
 * - editorial workflow events
 *
 * Does not mutate. Does not change schemas.
 */
import type {
  ChangeFieldDiff,
  ChangeSummaryViewModel,
  EditorialActivityViewModel,
  EditorialDiffViewModel,
  PublishedChangeViewModel,
  ReviewQueueViewModel,
  StaleContentItemViewModel,
} from "@/types/editorial-activity";
import type {
  EditorialWorkflowAction,
  EditorialWorkflowEntityType,
  EditorialWorkflowStatus,
} from "@/types/editorial-workflow";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  listArticleRevisions,
  listProductRevisions,
  listRecentArticleRevisions,
  listRecentProductRevisions,
} from "@/lib/db/revisions";
import {
  findWorkflowByEntity,
  listRecentWorkflowEvents,
  listWorkflowEvents,
  listWorkflowsByStatus,
} from "@/lib/editorial-workflow-store";

/** Phase 34/35 allowlisted surfaces for public change intelligence. */
const PRODUCT_ALLOWED_FIELDS = [
  "editorial.role",
  "editorial.verdict",
  "editorial.bestFor",
  "editorial.notFor",
] as const;

const ARTICLE_ALLOWED_FIELDS = [
  "editorial.summary",
  "editorial.audience",
  "editorial.intent",
  "seo.metaTitle",
  "seo.metaDescription",
  "seo.primaryKeyword",
  "seo.secondaryKeywords",
] as const;

const WORKFLOW_ACTION_MAP: Record<
  EditorialWorkflowAction,
  EditorialActivityViewModel["action"]
> = {
  create: "workflow_create",
  submit: "workflow_submit",
  approve: "workflow_approve",
  publish: "workflow_publish",
  reopen: "workflow_reopen",
};

function displayValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return JSON.stringify(value);
}

function getNested(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildAllowedFieldDiffs(
  entityType: EditorialWorkflowEntityType,
  before: unknown,
  after: unknown,
): ChangeFieldDiff[] {
  const fields =
    entityType === "product" ? PRODUCT_ALLOWED_FIELDS : ARTICLE_ALLOWED_FIELDS;
  const diffs: ChangeFieldDiff[] = [];
  for (const field of fields) {
    const left = getNested(before, field);
    const right = getNested(after, field);
    if (same(left, right)) continue;
    diffs.push({
      field,
      before: displayValue(left),
      after: displayValue(right),
    });
  }
  return diffs;
}

type NameMaps = {
  products: Map<string, string>;
  articles: Map<string, string>;
  productDocs: Map<string, ProductV1Document>;
  articleDocs: Map<string, ArticleV1>;
};

async function loadNameMaps(): Promise<NameMaps> {
  const articles = await listArticlesV1();
  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();

  return {
    products: new Map(products.map((p) => [p.id, p.identity.name])),
    articles: new Map(articles.map((a) => [a.identity.id, a.identity.title])),
    productDocs: new Map(products.map((p) => [p.id, p])),
    articleDocs: new Map(articles.map((a) => [a.identity.id, a])),
  };
}

function entityName(
  maps: NameMaps,
  entityType: EditorialWorkflowEntityType,
  entityId: string,
  fallback?: string,
): string {
  if (entityType === "product") {
    return maps.products.get(entityId) ?? fallback ?? entityId;
  }
  return maps.articles.get(entityId) ?? fallback ?? entityId;
}

function entityExists(
  maps: NameMaps,
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): boolean {
  return entityType === "product"
    ? maps.productDocs.has(entityId)
    : maps.articleDocs.has(entityId);
}

/**
 * Resolve after-state for a revision given an already-loaded desc-ordered list.
 * revision[i].data = before; after = live (i===0) or revisions[i-1].data.
 */
function afterFromRevisionList<T extends { id: string; data: unknown }>(
  revisions: T[],
  revisionId: string,
  live: unknown,
): unknown | undefined {
  const index = revisions.findIndex((r) => r.id === revisionId);
  if (index < 0) return undefined;
  if (index === 0) return live;
  return revisions[index - 1]!.data;
}

export async function getRecentEditorialActivity(
  limit = 40,
): Promise<EditorialActivityViewModel[]> {
  if (!isDatabaseContentStore()) return [];

  const maps = await loadNameMaps();
  const items: EditorialActivityViewModel[] = [];

  const [productRevs, articleRevs, workflowEvents] = await Promise.all([
    listRecentProductRevisions(limit),
    listRecentArticleRevisions(limit),
    listRecentWorkflowEvents(limit),
  ]);

  // Cache per-entity revision chains for correct before/after pairing.
  const productChains = new Map<string, Awaited<ReturnType<typeof listProductRevisions>>>();
  const articleChains = new Map<string, Awaited<ReturnType<typeof listArticleRevisions>>>();
  const workflowCache = new Map<string, EditorialWorkflowStatus | null>();

  async function workflowStatus(
    entityType: EditorialWorkflowEntityType,
    entityId: string,
  ): Promise<EditorialWorkflowStatus | null> {
    const key = `${entityType}:${entityId}`;
    if (workflowCache.has(key)) return workflowCache.get(key)!;
    const wf = await findWorkflowByEntity(entityType, entityId);
    const status = wf?.status ?? null;
    workflowCache.set(key, status);
    return status;
  }

  for (const rev of productRevs) {
    if (!entityExists(maps, "product", rev.productId)) continue;
    if (!productChains.has(rev.productId)) {
      productChains.set(rev.productId, await listProductRevisions(rev.productId));
    }
    const chain = productChains.get(rev.productId)!;
    const after = afterFromRevisionList(
      chain,
      rev.id,
      maps.productDocs.get(rev.productId),
    );
    const diffs = after
      ? buildAllowedFieldDiffs("product", rev.data, after)
      : [];
    items.push({
      id: `product-rev:${rev.id}`,
      entityType: "product",
      entityId: rev.productId,
      entityName: entityName(
        maps,
        "product",
        rev.productId,
        rev.data.identity?.name,
      ),
      action: "revision",
      actor: rev.createdBy,
      timestamp: rev.createdAt.toISOString(),
      workflowStatus: await workflowStatus("product", rev.productId),
      summary:
        diffs.length > 0 ? diffs.map((d) => d.field) : ["revision snapshot"],
    });
  }

  for (const rev of articleRevs) {
    if (!entityExists(maps, "article", rev.articleId)) continue;
    if (!articleChains.has(rev.articleId)) {
      articleChains.set(rev.articleId, await listArticleRevisions(rev.articleId));
    }
    const chain = articleChains.get(rev.articleId)!;
    const after = afterFromRevisionList(
      chain,
      rev.id,
      maps.articleDocs.get(rev.articleId),
    );
    const diffs = after
      ? buildAllowedFieldDiffs("article", rev.data, after)
      : [];
    items.push({
      id: `article-rev:${rev.id}`,
      entityType: "article",
      entityId: rev.articleId,
      entityName: entityName(
        maps,
        "article",
        rev.articleId,
        rev.data.identity?.title,
      ),
      action: "revision",
      actor: rev.createdBy,
      timestamp: rev.createdAt.toISOString(),
      workflowStatus: await workflowStatus("article", rev.articleId),
      summary:
        diffs.length > 0 ? diffs.map((d) => d.field) : ["revision snapshot"],
    });
  }

  for (const event of workflowEvents) {
    if (!entityExists(maps, event.entityType, event.entityId)) continue;
    items.push({
      id: `workflow:${event.id}`,
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: entityName(maps, event.entityType, event.entityId),
      action: WORKFLOW_ACTION_MAP[event.action] ?? "workflow_create",
      actor: event.actor,
      timestamp: event.createdAt,
      workflowStatus: event.workflowStatus,
      summary: [`${event.previousStatus ?? "—"} → ${event.newStatus}`],
    });
  }

  return items
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getEntityActivity(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<EditorialActivityViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const all = await getRecentEditorialActivity(200);
  return all.filter(
    (item) => item.entityType === entityType && item.entityId === entityId,
  );
}

export async function getPendingReviewItems(): Promise<ReviewQueueViewModel> {
  if (!isDatabaseContentStore()) {
    return { pendingCount: 0, items: [] };
  }

  const maps = await loadNameMaps();
  const workflows = await listWorkflowsByStatus("review");
  const items = [];

  for (const wf of workflows) {
    if (!entityExists(maps, wf.entityType, wf.entityId)) continue;
    const events = await listWorkflowEvents(wf.id);
    const submit = events.find((e) => e.action === "submit");
    items.push({
      entityType: wf.entityType,
      entityId: wf.entityId,
      entityName: entityName(maps, wf.entityType, wf.entityId),
      submittedBy: submit?.actor ?? wf.updatedBy,
      submittedAt: submit?.createdAt ?? wf.updatedAt,
      currentStatus: wf.status,
    });
  }

  items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { pendingCount: items.length, items };
}

export async function getPublishedChanges(
  limit = 30,
): Promise<PublishedChangeViewModel[]> {
  if (!isDatabaseContentStore()) return [];

  const maps = await loadNameMaps();
  const events = await listRecentWorkflowEvents(100);
  const published = events.filter((e) => e.action === "publish");
  const items: PublishedChangeViewModel[] = [];

  for (const event of published) {
    if (!entityExists(maps, event.entityType, event.entityId)) continue;
    items.push({
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: entityName(maps, event.entityType, event.entityId),
      publishedBy: event.actor,
      publishedAt: event.createdAt,
    });
    if (items.length >= limit) break;
  }

  return items;
}

export async function getChangeSummaries(
  limit = 30,
): Promise<ChangeSummaryViewModel[]> {
  if (!isDatabaseContentStore()) return [];

  const maps = await loadNameMaps();
  const [productRevs, articleRevs] = await Promise.all([
    listRecentProductRevisions(limit),
    listRecentArticleRevisions(limit),
  ]);

  const summaries: ChangeSummaryViewModel[] = [];
  const productChains = new Map<string, Awaited<ReturnType<typeof listProductRevisions>>>();
  const articleChains = new Map<string, Awaited<ReturnType<typeof listArticleRevisions>>>();

  for (const rev of productRevs) {
    if (!entityExists(maps, "product", rev.productId)) continue;
    if (!productChains.has(rev.productId)) {
      productChains.set(rev.productId, await listProductRevisions(rev.productId));
    }
    const after = afterFromRevisionList(
      productChains.get(rev.productId)!,
      rev.id,
      maps.productDocs.get(rev.productId),
    );
    if (!after) continue;
    const diffs = buildAllowedFieldDiffs("product", rev.data, after);
    if (diffs.length === 0) continue;
    summaries.push({
      id: `product-rev:${rev.id}`,
      entityType: "product",
      entityId: rev.productId,
      entityName: entityName(maps, "product", rev.productId, rev.data.identity?.name),
      changedFields: diffs.map((d) => d.field),
      actor: rev.createdBy,
      timestamp: rev.createdAt.toISOString(),
      diffs,
    });
  }

  for (const rev of articleRevs) {
    if (!entityExists(maps, "article", rev.articleId)) continue;
    if (!articleChains.has(rev.articleId)) {
      articleChains.set(rev.articleId, await listArticleRevisions(rev.articleId));
    }
    const after = afterFromRevisionList(
      articleChains.get(rev.articleId)!,
      rev.id,
      maps.articleDocs.get(rev.articleId),
    );
    if (!after) continue;
    const diffs = buildAllowedFieldDiffs("article", rev.data, after);
    if (diffs.length === 0) continue;
    summaries.push({
      id: `article-rev:${rev.id}`,
      entityType: "article",
      entityId: rev.articleId,
      entityName: entityName(
        maps,
        "article",
        rev.articleId,
        rev.data.identity?.title,
      ),
      changedFields: diffs.map((d) => d.field),
      actor: rev.createdBy,
      timestamp: rev.createdAt.toISOString(),
      diffs,
    });
  }

  return summaries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getEditorialDiff(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
  revisionId: string,
): Promise<EditorialDiffViewModel | undefined> {
  if (!isDatabaseContentStore()) return undefined;
  const maps = await loadNameMaps();
  if (!entityExists(maps, entityType, entityId)) return undefined;

  if (entityType === "product") {
    const revisions = await listProductRevisions(entityId);
    const index = revisions.findIndex((r) => r.id === revisionId);
    if (index < 0) return undefined;
    const before = revisions[index]!;
    const after =
      index === 0
        ? maps.productDocs.get(entityId)
        : revisions[index - 1]!.data;
    if (!after) return undefined;
    return {
      entityType,
      entityId,
      entityName: entityName(maps, entityType, entityId),
      revisionId,
      actor: before.createdBy,
      timestamp: before.createdAt.toISOString(),
      diffs: buildAllowedFieldDiffs("product", before.data, after),
    };
  }

  const revisions = await listArticleRevisions(entityId);
  const index = revisions.findIndex((r) => r.id === revisionId);
  if (index < 0) return undefined;
  const before = revisions[index]!;
  const after =
    index === 0
      ? maps.articleDocs.get(entityId)
      : revisions[index - 1]!.data;
  if (!after) return undefined;
  return {
    entityType,
    entityId,
    entityName: entityName(maps, entityType, entityId),
    revisionId,
    actor: before.createdBy,
    timestamp: before.createdAt.toISOString(),
    diffs: buildAllowedFieldDiffs("article", before.data, after),
  };
}

const STALE_DAYS = 90;

export async function getStaleArticles(
  staleAfterDays = STALE_DAYS,
): Promise<StaleContentItemViewModel[]> {
  const maps = await loadNameMaps();
  const now = Date.now();
  const items: StaleContentItemViewModel[] = [];

  for (const article of maps.articleDocs.values()) {
    if (article.publishing.status !== "published") continue;
    const updated =
      article.publishing.updatedAt ?? article.publishing.publishedAt ?? null;
    if (!updated) continue;
    const ts = Date.parse(updated);
    if (Number.isNaN(ts)) continue;
    const days = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
    if (days < staleAfterDays) continue;
    items.push({
      entityType: "article",
      entityId: article.identity.id,
      entityName: article.identity.title,
      publishedAt: article.publishing.publishedAt ?? null,
      lastUpdatedAt: updated,
      daysSinceUpdate: days,
    });
  }

  return items.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

export type {
  EditorialActivityViewModel,
  ReviewQueueViewModel,
  ChangeSummaryViewModel,
  EditorialDiffViewModel,
};
