import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { isArticleV1, validateArticleV1 } from "@/lib/article-schema";
import { writeArticleMarkdownBodyContent } from "@/lib/content/article-markdown";
import type { ArticleV1 } from "@/types/article-v1";

const articleDataDirectory = path.join(process.cwd(), "content/article-data");
const postsDirectory = path.join(process.cwd(), "content/posts");

export type ArticleV1Record = {
  article: ArticleV1;
  body: string;
  sourceFile: string;
  version?: number;
};

function readArticleJson(filePath: string): ArticleV1 {
  const fileName = path.basename(filePath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[content/fs/articles] Failed to parse ${fileName}: ${detail}`);
  }

  const structural = validateArticleV1(parsed);
  if (!structural.valid || !isArticleV1(parsed)) {
    throw new Error(
      `[content/fs/articles] ${fileName} is not valid Article V1: ${structural.errors.join("; ")}`,
    );
  }

  return parsed;
}

function listArticleJsonFiles(): string[] {
  if (!fs.existsSync(articleDataDirectory)) return [];
  return fs
    .readdirSync(articleDataDirectory)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function readMarkdownBody(slug: string): string {
  const mdPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(mdPath)) {
    return "";
  }
  const raw = fs.readFileSync(mdPath, "utf8");
  return matter(raw).content;
}

export function listFilesystemArticleIds(): string[] {
  return listArticleJsonFiles().map((f) => {
    const article = readArticleJson(path.join(articleDataDirectory, f));
    return article.identity.id;
  });
}

export function listFilesystemArticlesV1(): ArticleV1[] {
  return listArticleJsonFiles().map((fileName) => {
    const record = getFilesystemArticleV1ByFile(fileName);
    if (!record) throw new Error(`[content/fs/articles] missing ${fileName}`);
    return record.article;
  });
}

export function getFilesystemArticleV1(id: string): ArticleV1Record | undefined {
  for (const fileName of listArticleJsonFiles()) {
    const record = getFilesystemArticleV1ByFile(fileName);
    if (!record) continue;
    if (record.article.identity.id === id || record.article.identity.slug === id) {
      return record;
    }
  }
  return undefined;
}

function getFilesystemArticleV1ByFile(fileName: string): ArticleV1Record | undefined {
  const filePath = path.join(articleDataDirectory, fileName);
  if (!fs.existsSync(filePath)) return undefined;
  const article = readArticleJson(filePath);
  return {
    article,
    body: readMarkdownBody(article.identity.slug),
    sourceFile: fileName,
  };
}

export function saveFilesystemArticleV1(
  article: ArticleV1,
  sourceFile: string,
  body?: string,
): void {
  const filePath = path.join(articleDataDirectory, sourceFile);
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${sourceFile}.${process.pid}.tmp`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tempPath, `${JSON.stringify(article, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
  if (typeof body === "string") {
    writeArticleMarkdownBodyContent(article.identity.slug, body);
  }
}

export function getFilesystemPublishedSlugs(): string[] {
  const slugs: string[] = [];
  if (!fs.existsSync(postsDirectory)) return slugs;

  for (const fileName of fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".md"))) {
    const slug = fileName.replace(/\.md$/, "");
    const record = getFilesystemArticleV1(slug);
    if (record && record.article.publishing.status === "published") {
      slugs.push(slug);
    }
  }
  return slugs;
}
