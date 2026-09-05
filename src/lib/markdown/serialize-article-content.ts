/**
 * Serialize structured content blocks back to Markdown (Phase 39).
 *
 * Uses sourceMarkdown slices for lossless round-trip when available.
 */
import type { ContentBlock } from "@/types/content-document";

export function serializeContentBlock(block: ContentBlock): string {
  if (block.sourceMarkdown?.trim()) {
    return block.sourceMarkdown.trim();
  }

  switch (block.type) {
    case "heading":
      return `${"#".repeat(block.level)} ${block.content}`;
    case "paragraph":
      return block.content;
    case "product-reference":
      return block.content ?? `Product reference: \`${block.productId}\``;
    case "comparison-table":
      return block.markdown;
    case "pros-cons": {
      const pros = block.pros.map((p) => `- ${p}`).join("\n");
      const cons = block.cons.map((c) => `- ${c}`).join("\n");
      const title = block.heading ? `## ${block.heading}\n\n` : "";
      return `${title}### Pros\n${pros}\n\n### Cons\n${cons}`.trim();
    }
    case "callout":
      return block.content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    default:
      return "";
  }
}

export function serializeContentBlocksToMarkdown(blocks: ContentBlock[]): string {
  const parts: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1];

    if (
      block.type === "heading" &&
      next?.sourceMarkdown.startsWith(block.sourceMarkdown)
    ) {
      continue;
    }

    const text =
      block.sourceMarkdown?.trim() || serializeContentBlock(block).trim();
    if (text) parts.push(text);
  }

  return parts.join("\n\n").trim();
}
