/**
 * CMS editor read model (Phase 39) — derived only.
 */
import type {
  ContentBlock,
  ContentBlockValidationIssue,
} from "@/types/content-document";
import type { EditorialWorkflowStatus } from "@/types/editorial-workflow";

export type ContentEditorProductRef = {
  productId: string;
  name: string;
  rank?: number;
  role?: string;
};

export type ContentEditorViewModel = {
  articleId: string;
  articleTitle: string;
  blocks: ContentBlock[];
  rawBody: string;
  blockCount: number;
  blockTypes: string[];
  products: ContentEditorProductRef[];
  validationStatus: "valid" | "invalid";
  validationErrors: ContentBlockValidationIssue[];
  workflowStatus: EditorialWorkflowStatus | null;
  /** True when workflow allows controlled writes (draft). */
  mutationAllowed: boolean;
  parseWarnings: string[];
};
