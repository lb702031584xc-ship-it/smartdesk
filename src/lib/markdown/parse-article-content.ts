/**
 * Parse Markdown body into structured content blocks (Phase 39).
 *
 * View model only — does not modify canonical storage.
 * Heuristic parser aligned with production editorial conventions.
 */
import type {
  ContentBlock,
  ContentDocumentViewModel,
} from "@/types/content-document";

let blockCounter = 0;

function nextBlockId(prefix: string): string {
  blockCounter += 1;
  return `${prefix}-${blockCounter}`;
}

function extractProductId(text: string): string | undefined {
  const match = text.match(/`([a-z0-9-]+)`/);
  return match?.[1];
}

function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split("\n");
  return lines.some((line) => line.trim().startsWith("|"));
}

function isBlockquoteCallout(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith(">") && !trimmed.startsWith("##");
}

function parseCalloutVariant(text: string): "info" | "warning" | "tip" {
  const lower = text.toLowerCase();
  if (lower.includes("warning") || lower.includes("avoid")) return "warning";
  if (lower.includes("tip") || lower.includes("how to use")) return "tip";
  return "info";
}

function stripCalloutPrefix(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n")
    .trim();
}

function parseProsConsSection(
  sectionMarkdown: string,
  heading: string,
): ContentBlock | null {
  const buyMatch = sectionMarkdown.match(
    /### Who should buy\s*\n+([\s\S]*?)(?=### Who should avoid|$)/i,
  );
  const avoidMatch = sectionMarkdown.match(
    /### Who should avoid\s*\n+([\s\S]*?)$/i,
  );

  if (!buyMatch && !avoidMatch) return null;

  function bulletsFrom(text: string): string[] {
    return text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean);
  }

  const pros = buyMatch ? bulletsFrom(buyMatch[1]!) : [];
  const cons = avoidMatch ? bulletsFrom(avoidMatch[1]!) : [];

  if (pros.length === 0 && cons.length === 0) return null;

  return {
    id: nextBlockId("pros-cons"),
    type: "pros-cons",
    pros: pros.length > 0 ? pros : ["(none parsed)"],
    cons: cons.length > 0 ? cons : ["(none parsed)"],
    heading,
    sourceMarkdown: sectionMarkdown.trim(),
  };
}

function classifySection(
  heading: string,
  body: string,
  knownProductIds?: Set<string>,
): ContentBlock[] {
  const sectionMarkdown = `## ${heading}\n\n${body}`.trim();
  const blocks: ContentBlock[] = [
    {
      id: nextBlockId("heading"),
      type: "heading",
      level: 2,
      content: heading,
      sourceMarkdown: `## ${heading}`,
    },
  ];

  const productId = extractProductId(body);
  const roleHeading =
    /^(Best Overall|Best Budget|Best Space Saving|Introduction|Quick Comparison)/i.test(
      heading,
    );

  if (productId && roleHeading && heading !== "Quick Comparison") {
    blocks.push({
      id: nextBlockId("product-ref"),
      type: "product-reference",
      productId,
      heading,
      content: body.trim(),
      sourceMarkdown: sectionMarkdown,
    });
    return blocks;
  }

  if (heading === "Quick Comparison" && isMarkdownTable(body)) {
    blocks.push({
      id: nextBlockId("table"),
      type: "comparison-table",
      markdown: body.trim(),
      sourceMarkdown: sectionMarkdown,
    });
    return blocks;
  }

  const prosCons = parseProsConsSection(sectionMarkdown, heading);
  if (prosCons) {
    blocks.push(prosCons);
    return blocks;
  }

  if (isBlockquoteCallout(body)) {
    blocks.push({
      id: nextBlockId("callout"),
      type: "callout",
      variant: parseCalloutVariant(body),
      content: stripCalloutPrefix(body),
      sourceMarkdown: sectionMarkdown,
    });
    return blocks;
  }

  if (body.trim()) {
    blocks.push({
      id: nextBlockId("paragraph"),
      type: "paragraph",
      content: body.trim(),
      sourceMarkdown: sectionMarkdown,
    });
  }

  if (
    productId &&
    knownProductIds?.has(productId) &&
    !blocks.some((b) => b.type === "product-reference")
  ) {
    blocks.push({
      id: nextBlockId("product-ref"),
      type: "product-reference",
      productId,
      heading,
      content: body.trim(),
      sourceMarkdown: sectionMarkdown,
    });
  }

  return blocks;
}

export type ParseArticleContentOptions = {
  knownProductIds?: string[];
};

/**
 * Derive structured blocks from Markdown without changing storage.
 */
export function parseArticleContent(
  body: string,
  options: ParseArticleContentOptions = {},
): ContentDocumentViewModel {
  blockCounter = 0;
  const rawBody = body ?? "";
  const parseWarnings: string[] = [];
  const knownProductIds = new Set(options.knownProductIds ?? []);

  if (!rawBody.trim()) {
    return { blocks: [], rawBody, parseWarnings };
  }

  const sections = rawBody.split(/\n(?=## )/);
  const preamble = sections[0]?.startsWith("## ")
    ? undefined
    : sections.shift()?.trim();

  const blocks: ContentBlock[] = [];

  if (preamble) {
    if (isBlockquoteCallout(preamble)) {
      blocks.push({
        id: nextBlockId("callout"),
        type: "callout",
        variant: parseCalloutVariant(preamble),
        content: stripCalloutPrefix(preamble),
        sourceMarkdown: preamble,
      });
    } else {
      blocks.push({
        id: nextBlockId("paragraph"),
        type: "paragraph",
        content: preamble,
        sourceMarkdown: preamble,
      });
    }
  }

  for (const section of sections) {
    const match = section.match(/^## (.+)\n([\s\S]*)$/);
    if (!match) {
      parseWarnings.push("Unparsed section fragment.");
      if (section.trim()) {
        blocks.push({
          id: nextBlockId("paragraph"),
          type: "paragraph",
          content: section.trim(),
          sourceMarkdown: section.trim(),
        });
      }
      continue;
    }

    const heading = match[1]!.trim();
    const sectionBody = match[2] ?? "";
    blocks.push(...classifySection(heading, sectionBody, knownProductIds));
  }

  return {
    blocks,
    rawBody,
    preamble,
    parseWarnings,
  };
}

export function summarizeContentBlocks(blocks: ContentBlock[]): {
  blockCount: number;
  blockTypes: string[];
} {
  const types = [...new Set(blocks.map((b) => b.type))];
  return { blockCount: blocks.length, blockTypes: types };
}
