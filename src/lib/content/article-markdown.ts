import fs from "fs";
import path from "path";

const postsDirectory = path.join(process.cwd(), "content/posts");

export function articleMarkdownPath(slug: string): string {
  return path.join(postsDirectory, `${slug}.md`);
}

export function articleMarkdownExists(slug: string): boolean {
  return fs.existsSync(articleMarkdownPath(slug));
}

export function buildArticleMarkdownPointer(slug: string): string {
  return `---\nschemaVersion: 1\narticleData: ${slug}.json\n---\n\n`;
}

/**
 * Exclusive create of the Markdown body pointer file.
 * Does not write ArticleV1 metadata JSON — DB remains metadata authority.
 */
export function createArticleMarkdownBody(
  slug: string,
): { ok: true; path: string } | { ok: false; reason: "exists" | "write-failed"; detail?: string } {
  const mdPath = articleMarkdownPath(slug);
  try {
    fs.mkdirSync(postsDirectory, { recursive: true });
    fs.writeFileSync(mdPath, buildArticleMarkdownPointer(slug), { encoding: "utf8", flag: "wx" });
    return { ok: true, path: mdPath };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return { ok: false, reason: "exists" };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "write-failed", detail };
  }
}

export function deleteArticleMarkdownBody(slug: string): void {
  const mdPath = articleMarkdownPath(slug);
  if (fs.existsSync(mdPath)) {
    fs.unlinkSync(mdPath);
  }
}

/**
 * Development filesystem mode only: replace Markdown body while keeping the V1 pointer frontmatter.
 * Database Admin saves must not call this (Neon body is production authority).
 */
export function writeArticleMarkdownBodyContent(slug: string, body: string): void {
  const mdPath = articleMarkdownPath(slug);
  fs.mkdirSync(postsDirectory, { recursive: true });
  fs.writeFileSync(mdPath, `${buildArticleMarkdownPointer(slug)}${body}`, "utf8");
}

/**
 * Article create needs a writable posts directory for Markdown snapshot parity.
 * Neon already stores durable body text; Markdown is the filesystem body source.
 */
export function canCreateArticleMarkdown(): boolean {
  try {
    fs.mkdirSync(postsDirectory, { recursive: true });
    const probe = path.join(postsDirectory, `.write-probe-${process.pid}.tmp`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
