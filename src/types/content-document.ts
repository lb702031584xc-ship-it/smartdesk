/**
 * Structured content view/edit models (Phase 39).
 *
 * Derived from Markdown body — NOT canonical ArticleV1 storage.
 * ArticleV1 metadata + Markdown body remain the authority.
 */

export type ContentBlockType =
  | "heading"
  | "paragraph"
  | "product-reference"
  | "comparison-table"
  | "pros-cons"
  | "callout";

export type HeadingContentBlock = {
  id: string;
  type: "heading";
  level: 2 | 3;
  content: string;
  /** Exact markdown slice for lossless round-trip. */
  sourceMarkdown: string;
};

export type ParagraphContentBlock = {
  id: string;
  type: "paragraph";
  content: string;
  sourceMarkdown: string;
};

export type ProductReferenceContentBlock = {
  id: string;
  type: "product-reference";
  productId: string;
  heading?: string;
  content?: string;
  sourceMarkdown: string;
};

export type ComparisonTableContentBlock = {
  id: string;
  type: "comparison-table";
  markdown: string;
  sourceMarkdown: string;
};

export type ProsConsContentBlock = {
  id: string;
  type: "pros-cons";
  pros: string[];
  cons: string[];
  heading?: string;
  sourceMarkdown: string;
};

export type CalloutContentBlock = {
  id: string;
  type: "callout";
  variant: "info" | "warning" | "tip";
  content: string;
  sourceMarkdown: string;
};

export type ContentBlock =
  | HeadingContentBlock
  | ParagraphContentBlock
  | ProductReferenceContentBlock
  | ComparisonTableContentBlock
  | ProsConsContentBlock
  | CalloutContentBlock;

export type ContentBlockValidationIssue = {
  blockId?: string;
  field?: string;
  message: string;
};

export type ContentDocumentViewModel = {
  blocks: ContentBlock[];
  rawBody: string;
  /** Markdown not mapped to a typed block (e.g. frontmatter tail). */
  preamble?: string;
  parseWarnings: string[];
};

export type ContentBlockValidationResult = {
  valid: boolean;
  errors: ContentBlockValidationIssue[];
};
