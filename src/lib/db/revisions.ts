import { randomUUID } from "node:crypto";
import { and, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  articleRevisions,
  articles,
  productRevisions,
  products,
} from "@/lib/db/schema";
import { normalizeArticleV1 } from "@/lib/admin/normalize-article";
import { normalizeProductV1 } from "@/lib/admin/normalize-product";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type ArticleRevisionRecord = {
  id: string;
  articleId: string;
  revisionNumber: number;
  data: ArticleV1;
  body: string;
  sourceVersion: number;
  createdAt: Date;
  createdBy: string;
};

export type ProductRevisionRecord = {
  id: string;
  productId: string;
  revisionNumber: number;
  data: ProductV1Document;
  sourceVersion: number;
  createdAt: Date;
  createdBy: string;
};

class StaleWriteError extends Error {
  readonly stale = true as const;
}

function articleSnapshotEqual(
  left: ArticleV1,
  leftBody: string,
  right: ArticleV1,
  rightBody: string,
): boolean {
  return (
    JSON.stringify(normalizeArticleV1(left)) === JSON.stringify(normalizeArticleV1(right)) &&
    leftBody === rightBody
  );
}

function productSnapshotEqual(left: ProductV1Document, right: ProductV1Document): boolean {
  return JSON.stringify(normalizeProductV1(left)) === JSON.stringify(normalizeProductV1(right));
}

async function nextArticleRevisionNumber(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0],
  articleId: string,
): Promise<number> {
  const [row] = await tx
    .select({ value: max(articleRevisions.revisionNumber) })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId));
  return (row?.value ?? 0) + 1;
}

async function nextProductRevisionNumber(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0],
  productId: string,
): Promise<number> {
  const [row] = await tx
    .select({ value: max(productRevisions.revisionNumber) })
    .from(productRevisions)
    .where(eq(productRevisions.productId, productId));
  return (row?.value ?? 0) + 1;
}

export async function countArticleRevisions(articleId: string): Promise<number> {
  const rows = await (await getDb())
    .select({ id: articleRevisions.id })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId));
  return rows.length;
}

export async function countProductRevisions(productId: string): Promise<number> {
  const rows = await (await getDb())
    .select({ id: productRevisions.id })
    .from(productRevisions)
    .where(eq(productRevisions.productId, productId));
  return rows.length;
}

export async function listArticleRevisions(articleId: string): Promise<ArticleRevisionRecord[]> {
  const rows = await (await getDb())
    .select()
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(desc(articleRevisions.revisionNumber));

  return rows.map((row) => ({
    id: row.id,
    articleId: row.articleId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    body: row.body,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  }));
}

export async function getArticleRevision(
  articleId: string,
  revisionId: string,
): Promise<ArticleRevisionRecord | undefined> {
  const rows = await (await getDb())
    .select()
    .from(articleRevisions)
    .where(and(eq(articleRevisions.articleId, articleId), eq(articleRevisions.id, revisionId)))
    .limit(1);

  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    id: row.id,
    articleId: row.articleId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    body: row.body,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

export async function listProductRevisions(productId: string): Promise<ProductRevisionRecord[]> {
  const rows = await (await getDb())
    .select()
    .from(productRevisions)
    .where(eq(productRevisions.productId, productId))
    .orderBy(desc(productRevisions.revisionNumber));

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  }));
}

export async function getProductRevision(
  productId: string,
  revisionId: string,
): Promise<ProductRevisionRecord | undefined> {
  const rows = await (await getDb())
    .select()
    .from(productRevisions)
    .where(and(eq(productRevisions.productId, productId), eq(productRevisions.id, revisionId)))
    .limit(1);

  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    id: row.id,
    productId: row.productId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

/** Phase 37 — read-only: recent product revisions across catalog. */
export async function listRecentProductRevisions(
  limit = 40,
): Promise<ProductRevisionRecord[]> {
  const rows = await (await getDb())
    .select()
    .from(productRevisions)
    .orderBy(desc(productRevisions.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  }));
}

/** Phase 37 — read-only: recent article revisions across catalog. */
export async function listRecentArticleRevisions(
  limit = 40,
): Promise<ArticleRevisionRecord[]> {
  const rows = await (await getDb())
    .select()
    .from(articleRevisions)
    .orderBy(desc(articleRevisions.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    articleId: row.articleId,
    revisionNumber: row.revisionNumber,
    data: row.data,
    body: row.body,
    sourceVersion: row.sourceVersion,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  }));
}

export async function upsertDatabaseArticleV1WithRevision(
  article: ArticleV1,
  body: string,
  options?: { expectedVersion?: number; createdBy?: string },
): Promise<
  | { ok: true; version: number; revisionCreated: boolean }
  | { ok: false; stale: true }
> {
  const db = await getDb();

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(articles)
        .where(eq(articles.id, article.identity.id))
        .for("update");

      const existing = rows[0];
      if (!existing) {
        throw new Error(`Article not found: ${article.identity.id}`);
      }

      if (options?.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
        throw new StaleWriteError();
      }

      if (articleSnapshotEqual(existing.data, existing.body, article, body)) {
        return { ok: true as const, version: existing.version, revisionCreated: false };
      }

      if (options?.createdBy) {
        const revisionNumber = await nextArticleRevisionNumber(tx, existing.id);
        await tx.insert(articleRevisions).values({
          id: randomUUID(),
          articleId: existing.id,
          revisionNumber,
          data: existing.data,
          body: existing.body,
          sourceVersion: existing.version,
          createdBy: options.createdBy,
        });
      }

      const nextVersion = existing.version + 1;
      await tx
        .update(articles)
        .set({
          slug: article.identity.slug,
          status: article.publishing.status,
          body,
          data: article,
          version: nextVersion,
          dbUpdatedAt: new Date(),
        })
        .where(eq(articles.id, existing.id));

      return {
        ok: true as const,
        version: nextVersion,
        revisionCreated: Boolean(options?.createdBy),
      };
    });
  } catch (error) {
    if (error instanceof StaleWriteError) {
      return { ok: false, stale: true };
    }
    throw error;
  }
}

export async function upsertDatabaseProductV1WithRevision(
  product: ProductV1Document,
  options?: { expectedVersion?: number; createdBy?: string },
): Promise<
  | { ok: true; version: number; revisionCreated: boolean }
  | { ok: false; stale: true }
> {
  const db = await getDb();

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(products)
        .where(eq(products.id, product.id))
        .for("update");

      const existing = rows[0];
      if (!existing) {
        throw new Error(`Product not found: ${product.id}`);
      }

      if (options?.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
        throw new StaleWriteError();
      }

      if (productSnapshotEqual(existing.data, product)) {
        return { ok: true as const, version: existing.version, revisionCreated: false };
      }

      if (options?.createdBy) {
        const revisionNumber = await nextProductRevisionNumber(tx, existing.id);
        await tx.insert(productRevisions).values({
          id: randomUUID(),
          productId: existing.id,
          revisionNumber,
          data: existing.data,
          sourceVersion: existing.version,
          createdBy: options.createdBy,
        });
      }

      const nextVersion = existing.version + 1;
      await tx
        .update(products)
        .set({
          category: product.identity.category,
          data: product,
          version: nextVersion,
          dbUpdatedAt: new Date(),
        })
        .where(eq(products.id, existing.id));

      return {
        ok: true as const,
        version: nextVersion,
        revisionCreated: Boolean(options?.createdBy),
      };
    });
  } catch (error) {
    if (error instanceof StaleWriteError) {
      return { ok: false, stale: true };
    }
    throw error;
  }
}

export async function publishScheduledArticleWithRevision(options: {
  articleId: string;
  updatedArticle: ArticleV1;
  now: Date;
  actor: string;
}): Promise<"published" | "skipped"> {
  const db = await getDb();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(articles)
      .where(and(eq(articles.id, options.articleId), eq(articles.status, "scheduled")))
      .for("update");

    const existing = rows[0];
    if (!existing) return "skipped";

    const revisionNumber = await nextArticleRevisionNumber(tx, existing.id);
    await tx.insert(articleRevisions).values({
      id: randomUUID(),
      articleId: existing.id,
      revisionNumber,
      data: existing.data,
      body: existing.body,
      sourceVersion: existing.version,
      createdBy: options.actor,
    });

    await tx
      .update(articles)
      .set({
        status: "published",
        data: options.updatedArticle,
        version: existing.version + 1,
        dbUpdatedAt: options.now,
      })
      .where(eq(articles.id, existing.id));

    return "published";
  });
}

export async function deleteArticleRevisionsForArticle(articleId: string): Promise<void> {
  await (await getDb()).delete(articleRevisions).where(eq(articleRevisions.articleId, articleId));
}

export async function deleteProductRevisionsForProduct(productId: string): Promise<void> {
  await (await getDb()).delete(productRevisions).where(eq(productRevisions.productId, productId));
}
