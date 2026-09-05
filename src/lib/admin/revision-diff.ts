import { articleChangeSummary, productChangeSummary } from "./change-summary";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function summarizeArticleRevisionChanges(
  before: ArticleV1,
  after: ArticleV1,
  beforeBody: string,
  afterBody: string,
): string[] {
  const lines = articleChangeSummary(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
  ).map((line) => `${line.section}: ${line.detail}`);

  if (beforeBody !== afterBody) {
    const beforeWords = wordCount(beforeBody);
    const afterWords = wordCount(afterBody);
    lines.push(`Article Body: ${beforeWords} → ${afterWords} words`);
  }

  return lines;
}

export function summarizeProductRevisionChanges(
  before: ProductV1Document,
  after: ProductV1Document,
): string[] {
  return productChangeSummary(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
  ).map((line) => `${line.section}: ${line.detail}`);
}
