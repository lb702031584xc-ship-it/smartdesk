import { cache } from "react";
import { isDatabaseContentStore } from "./store-config";
import {
  getFilesystemArticleV1,
  getFilesystemPublishedSlugs,
  listFilesystemArticleIds,
  listFilesystemArticlesV1,
  saveFilesystemArticleV1,
} from "./filesystem-articles";
import {
  deleteDatabaseArticleV1,
  getDatabaseArticleV1,
  getDatabaseArticleV1BySlug,
  insertDatabaseArticleV1,
  listDatabaseArticleIds,
  listDatabaseArticlesV1,
  listDatabasePublishedSlugs,
  upsertDatabaseArticleV1,
} from "./database-articles";
import { upsertDatabaseArticleV1WithRevision } from "@/lib/db/revisions";
import type { ArticleV1 } from "@/types/article-v1";

export type ArticleV1Record = {
  article: ArticleV1;
  body: string;
  sourceFile: string;
  version?: number;
};

const loadAllArticlesV1 = cache(async (): Promise<ArticleV1[]> => {
  if (isDatabaseContentStore()) {
    return await listDatabaseArticlesV1();
  }
  return listFilesystemArticlesV1();
});

export async function listArticleV1Ids(): Promise<string[]> {
  if (isDatabaseContentStore()) {
    return await listDatabaseArticleIds();
  }
  return listFilesystemArticleIds();
}

export async function getArticleV1(id: string): Promise<ArticleV1Record | undefined> {
  if (isDatabaseContentStore()) {
    return await getDatabaseArticleV1(id);
  }
  return getFilesystemArticleV1(id);
}

export async function getArticleV1BySlug(slug: string): Promise<ArticleV1Record | undefined> {
  if (isDatabaseContentStore()) {
    return await getDatabaseArticleV1BySlug(slug);
  }
  return getFilesystemArticleV1(slug);
}

export async function listArticlesV1(): Promise<ArticleV1[]> {
  return await loadAllArticlesV1();
}

export async function listPublishedArticleSlugs(): Promise<string[]> {
  if (isDatabaseContentStore()) {
    return await listDatabasePublishedSlugs();
  }
  return getFilesystemPublishedSlugs();
}

export async function insertArticleV1(
  article: ArticleV1,
  body: string,
): Promise<
  | { ok: true; version: number }
  | { ok: false; duplicate: "id" | "slug" }
  | { ok: false; error: string }
> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      error: "Article creation is only available when CONTENT_STORE=database.",
    };
  }
  const result = await insertDatabaseArticleV1(article, body);
  if (!result.ok) return result;
  return { ok: true, version: result.version };
}

export async function deleteArticleV1Record(id: string): Promise<void> {
  if (!isDatabaseContentStore()) {
    throw new Error("Article record delete is only available in database content store.");
  }
  await deleteDatabaseArticleV1(id);
}

export async function saveArticleV1(
  article: ArticleV1,
  body: string,
  options?: { sourceFile?: string; expectedVersion?: number; createdBy?: string },
): Promise<
  | { ok: true; version?: number; revisionCreated?: boolean }
  | { ok: false; stale: true }
  | { ok: false; error: string }
> {
  if (isDatabaseContentStore()) {
    if (options?.createdBy) {
      const result = await upsertDatabaseArticleV1WithRevision(article, body, {
        expectedVersion: options.expectedVersion,
        createdBy: options.createdBy,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        version: result.version,
        revisionCreated: result.revisionCreated,
      };
    }

    const result = await upsertDatabaseArticleV1(article, body, {
      expectedVersion: options?.expectedVersion,
    });
    if (!result.ok) return result;
    return { ok: true, version: result.version };
  }

  const sourceFile = options?.sourceFile ?? `${article.identity.slug}.json`;
  saveFilesystemArticleV1(article, sourceFile, body);
  return { ok: true };
}
