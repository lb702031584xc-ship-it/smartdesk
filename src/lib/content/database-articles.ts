import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import {
  isArticleV1,
  validateArticleV1,
} from "@/lib/article-schema";
import type { ArticleV1 } from "@/types/article-v1";

export type ArticleV1Record = {
  article: ArticleV1;
  body: string;
  sourceFile: string;
  version: number;
};

function parseArticleRow(row: {
  id: string;
  slug: string;
  status: string;
  body: string;
  data: ArticleV1;
  version: number;
}): ArticleV1 {
  const data = row.data;
  const structural = validateArticleV1(data);
  if (!structural.valid || !isArticleV1(data)) {
    throw new Error(
      `[content/db/articles] Invalid Article V1 (${row.id}): ${structural.errors.join("; ")}`,
    );
  }
  return data;
}

export async function listDatabaseArticleIds(): Promise<string[]> {
  const rows = await (await getDb()).select({ id: articles.id }).from(articles);
  return rows.map((r) => r.id).sort();
}

export async function listDatabaseArticlesV1(): Promise<ArticleV1[]> {
  const rows = await (await getDb()).select().from(articles);
  return rows.map((row) => parseArticleRow(row));
}

export async function getDatabaseArticleV1(id: string): Promise<ArticleV1Record | undefined> {
  const byId = await (await getDb())
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (byId.length > 0) {
    const row = byId[0];
    return {
      article: parseArticleRow(row),
      body: row.body,
      sourceFile: `${row.slug}.json`,
      version: row.version,
    };
  }

  const bySlug = await (await getDb())
    .select()
    .from(articles)
    .where(eq(articles.slug, id))
    .limit(1);

  if (bySlug.length === 0) return undefined;

  const row = bySlug[0];
  return {
    article: parseArticleRow(row),
    body: row.body,
    sourceFile: `${row.slug}.json`,
    version: row.version,
  };
}

export async function getDatabaseArticleV1BySlug(slug: string): Promise<ArticleV1Record | undefined> {
  const rows = await (await getDb())
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (rows.length === 0) return undefined;

  const row = rows[0];
  return {
    article: parseArticleRow(row),
    body: row.body,
    sourceFile: `${row.slug}.json`,
    version: row.version,
  };
}

export async function listDatabasePublishedSlugs(): Promise<string[]> {
  const rows = await (await getDb())
    .select({ slug: articles.slug, status: articles.status })
    .from(articles);

  return rows.filter((r) => r.status === "published").map((r) => r.slug);
}

export async function upsertDatabaseArticleV1(
  article: ArticleV1,
  body: string,
  options?: { expectedVersion?: number },
): Promise<{ ok: true; version: number } | { ok: false; stale: true }> {
  const existing = await getDatabaseArticleV1(article.identity.id);

  if (existing && options?.expectedVersion !== undefined) {
    if (existing.version !== options.expectedVersion) {
      return { ok: false, stale: true };
    }
  }

  const nextVersion = existing ? existing.version + 1 : 1;

  await (await getDb())
    .insert(articles)
    .values({
      id: article.identity.id,
      slug: article.identity.slug,
      status: article.publishing.status,
      body,
      data: article,
      version: nextVersion,
      dbUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: articles.id,
      set: {
        slug: article.identity.slug,
        status: article.publishing.status,
        body,
        data: article,
        version: nextVersion,
        dbUpdatedAt: new Date(),
      },
    });

  return { ok: true, version: nextVersion };
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (String(record.code ?? "") === "23505") return true;
    if (typeof record.message === "string" && /duplicate key|unique constraint/i.test(record.message)) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

export async function insertDatabaseArticleV1(
  article: ArticleV1,
  body: string,
): Promise<
  | { ok: true; version: number }
  | { ok: false; duplicate: "id" | "slug" }
> {
  const existingById = await getDatabaseArticleV1(article.identity.id);
  if (existingById) {
    return { ok: false, duplicate: "id" };
  }
  const existingBySlug = await getDatabaseArticleV1BySlug(article.identity.slug);
  if (existingBySlug) {
    return { ok: false, duplicate: "slug" };
  }

  try {
    await (await getDb()).insert(articles).values({
      id: article.identity.id,
      slug: article.identity.slug,
      status: article.publishing.status,
      body,
      data: article,
      version: 1,
      dbUpdatedAt: new Date(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const bySlug = await getDatabaseArticleV1BySlug(article.identity.slug);
      return { ok: false, duplicate: bySlug ? "slug" : "id" };
    }
    throw error;
  }

  return { ok: true, version: 1 };
}

export async function deleteDatabaseArticleV1(id: string): Promise<void> {
  await (await getDb()).delete(articles).where(eq(articles.id, id));
}
