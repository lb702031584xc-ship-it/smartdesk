import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";

/**
 * Production Markdown → HTML pipeline (remark + GFM + remark-html).
 * Shared by public article pages and Admin body preview.
 */
export function renderArticleMarkdown(markdown: string): string {
  return remark()
    .use(remarkGfm)
    .use(html, { sanitize: false })
    .processSync(markdown ?? "")
    .toString();
}
