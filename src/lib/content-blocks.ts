/**
 * CMS content block registry and validation (Phase 39).
 *
 * Supported block types only — no arbitrary HTML.
 */
import type {
  ContentBlock,
  ContentBlockType,
  ContentBlockValidationIssue,
  ContentBlockValidationResult,
} from "@/types/content-document";

export const CONTENT_BLOCK_TYPES: readonly ContentBlockType[] = [
  "heading",
  "paragraph",
  "product-reference",
  "comparison-table",
  "pros-cons",
  "callout",
] as const;

export type ContentBlockDefinition = {
  type: ContentBlockType;
  label: string;
  description: string;
  requiredFields: string[];
};

export const CONTENT_BLOCK_REGISTRY: Record<
  ContentBlockType,
  ContentBlockDefinition
> = {
  heading: {
    type: "heading",
    label: "Heading",
    description: "Section heading (H2/H3).",
    requiredFields: ["content", "level"],
  },
  paragraph: {
    type: "paragraph",
    label: "Paragraph",
    description: "Prose paragraph or section body.",
    requiredFields: ["content"],
  },
  "product-reference": {
    type: "product-reference",
    label: "Product reference",
    description: "Editorial product callout with catalog productId.",
    requiredFields: ["productId"],
  },
  "comparison-table": {
    type: "comparison-table",
    label: "Comparison table",
    description: "GFM markdown comparison table.",
    requiredFields: ["markdown"],
  },
  "pros-cons": {
    type: "pros-cons",
    label: "Pros / cons",
    description: "Structured pros and cons lists.",
    requiredFields: ["pros", "cons"],
  },
  callout: {
    type: "callout",
    label: "Callout",
    description: "Highlighted note or tip blockquote.",
    requiredFields: ["content"],
  },
};

const BLOCK_TYPE_SET = new Set<string>(CONTENT_BLOCK_TYPES);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isKnownContentBlockType(
  value: unknown,
): value is ContentBlockType {
  return typeof value === "string" && BLOCK_TYPE_SET.has(value);
}

export type ValidateContentBlocksOptions = {
  knownProductIds?: Set<string> | string[];
};

/**
 * Pure validation for structured content blocks.
 */
export function validateContentBlocks(
  blocks: unknown,
  options: ValidateContentBlocksOptions = {},
): ContentBlockValidationResult {
  const errors: ContentBlockValidationIssue[] = [];

  if (!Array.isArray(blocks)) {
    return {
      valid: false,
      errors: [{ message: "blocks must be an array." }],
    };
  }

  const knownProducts = options.knownProductIds
    ? new Set(
        Array.isArray(options.knownProductIds)
          ? options.knownProductIds
          : [...options.knownProductIds],
      )
    : null;

  for (const raw of blocks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({ message: "Each block must be an object." });
      continue;
    }

    const block = raw as Record<string, unknown>;
    const blockId = typeof block.id === "string" ? block.id : undefined;

    if (!isKnownContentBlockType(block.type)) {
      errors.push({
        blockId,
        field: "type",
        message: `Unknown block type: ${String(block.type)}`,
      });
      continue;
    }

    if (!isNonEmptyString(block.id)) {
      errors.push({ blockId, field: "id", message: "Block id is required." });
    }

    if (typeof block.sourceMarkdown !== "string") {
      errors.push({
        blockId,
        field: "sourceMarkdown",
        message: "sourceMarkdown must be a string for round-trip.",
      });
    }

    switch (block.type) {
      case "heading": {
        if (!isNonEmptyString(block.content)) {
          errors.push({
            blockId,
            field: "content",
            message: "heading.content is required.",
          });
        }
        if (block.level !== 2 && block.level !== 3) {
          errors.push({
            blockId,
            field: "level",
            message: "heading.level must be 2 or 3.",
          });
        }
        break;
      }
      case "paragraph": {
        if (!isNonEmptyString(block.content)) {
          errors.push({
            blockId,
            field: "content",
            message: "paragraph.content is required.",
          });
        }
        break;
      }
      case "product-reference": {
        if (!isNonEmptyString(block.productId)) {
          errors.push({
            blockId,
            field: "productId",
            message: "product-reference.productId is required.",
          });
        } else if (knownProducts && !knownProducts.has(block.productId)) {
          errors.push({
            blockId,
            field: "productId",
            message: `Unknown productId: ${block.productId}`,
          });
        }
        break;
      }
      case "comparison-table": {
        if (!isNonEmptyString(block.markdown)) {
          errors.push({
            blockId,
            field: "markdown",
            message: "comparison-table.markdown is required.",
          });
        } else if (!block.markdown.includes("|")) {
          errors.push({
            blockId,
            field: "markdown",
            message: "comparison-table must contain a GFM table.",
          });
        }
        break;
      }
      case "pros-cons": {
        if (!isStringArray(block.pros) || block.pros.length === 0) {
          errors.push({
            blockId,
            field: "pros",
            message: "pros-cons.pros must be a non-empty string array.",
          });
        }
        if (!isStringArray(block.cons) || block.cons.length === 0) {
          errors.push({
            blockId,
            field: "cons",
            message: "pros-cons.cons must be a non-empty string array.",
          });
        }
        break;
      }
      case "callout": {
        if (!isNonEmptyString(block.content)) {
          errors.push({
            blockId,
            field: "content",
            message: "callout.content is required.",
          });
        }
        if (
          block.variant !== undefined &&
          block.variant !== "info" &&
          block.variant !== "warning" &&
          block.variant !== "tip"
        ) {
          errors.push({
            blockId,
            field: "variant",
            message: "callout.variant must be info, warning, or tip.",
          });
        }
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidContentBlocks(
  blocks: ContentBlock[],
  options: ValidateContentBlocksOptions = {},
): ContentBlockValidationResult {
  return validateContentBlocks(blocks, options);
}
