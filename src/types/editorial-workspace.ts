/**
 * Unified Editorial Workspace read models (Phase 38).
 *
 * Composes Phase 34–37 capabilities into operator-facing view models.
 * No schema duplication. No new mutation surfaces.
 */

import type {
  ChangeSummaryViewModel,
  EditorialActivityViewModel,
  ReviewQueueViewModel,
} from "@/types/editorial-activity";
import type {
  EditorialWorkflowEntityType,
  EditorialWorkflowStatus,
  EditorialWorkflowView,
} from "@/types/editorial-workflow";

export type EditorialWorkspaceSurface =
  | "overview"
  | "edit"
  | "workflow"
  | "history"
  | "record";

export type EditorialWorkspaceLink = {
  surface: EditorialWorkspaceSurface;
  label: string;
  href: string;
  description: string;
};

export type EditorialWorkspaceViewModel = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  version: number | null;
  revisionCount: number;
  workflowStatus: EditorialWorkflowStatus | null;
  workflowUpdatedAt: string | null;
  workflowUpdatedBy: string | null;
  /** Recent entity-scoped activity (revisions + workflow events). */
  recentActivity: EditorialActivityViewModel[];
  /** Allowlisted editorial/SEO change summaries for this entity. */
  recentChanges: ChangeSummaryViewModel[];
  /** Navigation to existing controlled surfaces — no new edit paths. */
  links: EditorialWorkspaceLink[];
};

export type EditorialWorkspaceIndexViewModel = {
  pendingCount: number;
  reviewQueue: ReviewQueueViewModel;
  recentActivity: EditorialActivityViewModel[];
};

/** Server props for workflow panel embedded in workspace pages. */
export type EditorialWorkspaceContext = {
  workflow: EditorialWorkflowView | null;
  roles: ("editor" | "reviewer")[];
};
