import type { ChangeLine } from "./change-summary";

export function countArticleBodyWords(body: string): number {
  const trimmed = body.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countArticleBodyCharacters(body: string): number {
  return body.length;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Change-summary line when Markdown body differs. Not a full diff. */
export function articleBodyChangeLine(
  before: string,
  after: string,
): ChangeLine | null {
  if (before === after) return null;
  const beforeWords = countArticleBodyWords(before);
  const afterWords = countArticleBodyWords(after);
  const delta = afterWords - beforeWords;
  let detail = "Markdown body changed";
  if (delta > 0) detail += ` (+${delta} words)`;
  else if (delta < 0) detail += ` (${delta} words)`;
  return { section: "Article Body", detail };
}

export function isArticleBodyString(value: unknown): value is string {
  return typeof value === "string";
}
