/**
 * Editorial Task models (Phase 42).
 *
 * Operational work records — separate from ProductV1, ArticleV1, and AI layers.
 * Tasks track human work; they do not replace editorial workflow states.
 */

import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";
import type { AIRecommendationPriority } from "@/types/ai-recommendation";

export type EditorialTaskEntityType = EditorialWorkflowEntityType | "topic";

export type EditorialTaskSourceType =
  | "ai-recommendation"
  | "ai-suggestion"
  | "ai-assistance"
  | "manual";

export type EditorialTaskPriority = AIRecommendationPriority;

export type EditorialTaskStatus =
  | "open"
  | "in-progress"
  | "review"
  | "completed"
  | "cancelled";

export type EditorialTaskRecord = {
  id: string;
  entityType: EditorialTaskEntityType;
  entityId: string;
  sourceType: EditorialTaskSourceType;
  sourceId: string | null;
  title: string;
  description: string;
  priority: EditorialTaskPriority;
  status: EditorialTaskStatus;
  assignee: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EditorialTaskViewModel = {
  id: string;
  entityType: EditorialTaskEntityType;
  entityId: string;
  entityName: string;
  sourceType: EditorialTaskSourceType;
  sourceId: string | null;
  title: string;
  description: string;
  priority: EditorialTaskPriority;
  status: EditorialTaskStatus;
  assignee: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EditorialTaskQueueViewModel = {
  openCount: number;
  inProgressCount: number;
  reviewCount: number;
  completedCount: number;
  cancelledCount: number;
  items: EditorialTaskViewModel[];
  byStatus: {
    open: EditorialTaskViewModel[];
    "in-progress": EditorialTaskViewModel[];
    review: EditorialTaskViewModel[];
    completed: EditorialTaskViewModel[];
    cancelled: EditorialTaskViewModel[];
  };
};
