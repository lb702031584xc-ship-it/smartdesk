/**
 * Editorial Task service (Phase 42).
 *
 * Operational work tracking — does NOT mutate ProductV1 / ArticleV1,
 * accept AI suggestions, or change editorial workflow states.
 */
import { getAdminArticle, getAdminProduct } from "@/lib/admin";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { findAISuggestionById } from "@/lib/ai-suggestions-store";
import { buildAllRecommendations } from "@/lib/ai-recommendations";
import {
  deleteEditorialTasksForEntityForTests,
  findEditorialTaskById,
  insertEditorialTask,
  listAllEditorialTasks,
  listEditorialTasksByEntity,
  updateEditorialTaskFields,
} from "@/lib/editorial-tasks-store";
import type { AIRecommendationViewModel } from "@/types/ai-recommendation";
import type {
  EditorialTaskEntityType,
  EditorialTaskPriority,
  EditorialTaskQueueViewModel,
  EditorialTaskRecord,
  EditorialTaskSourceType,
  EditorialTaskStatus,
  EditorialTaskViewModel,
} from "@/types/editorial-task";

export type TaskErrorCode =
  | "INVALID_INPUT"
  | "INVALID_STATUS"
  | "INVALID_TRANSITION"
  | "ENTITY_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "NOT_FOUND"
  | "STORE_UNAVAILABLE";

export type TaskSuccess = {
  success: true;
  task: EditorialTaskViewModel;
};

export type TaskFailure = {
  success: false;
  error: TaskErrorCode;
  message: string;
};

export type TaskResult = TaskSuccess | TaskFailure;

export const TASK_STATUSES: readonly EditorialTaskStatus[] = [
  "open",
  "in-progress",
  "review",
  "completed",
  "cancelled",
] as const;

export const TASK_PRIORITIES: readonly EditorialTaskPriority[] = [
  "high",
  "medium",
  "low",
] as const;

export const TASK_SOURCE_TYPES: readonly EditorialTaskSourceType[] = [
  "ai-recommendation",
  "ai-suggestion",
  "manual",
] as const;

const ALLOWED_TRANSITIONS: Record<
  EditorialTaskStatus,
  readonly EditorialTaskStatus[]
> = {
  open: ["in-progress", "cancelled"],
  "in-progress": ["review", "open", "cancelled"],
  review: ["completed", "in-progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidTaskTransition(
  from: EditorialTaskStatus,
  to: EditorialTaskStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type CreateEditorialTaskInput = {
  entityType: EditorialTaskEntityType;
  entityId: string;
  sourceType: EditorialTaskSourceType;
  sourceId?: string | null;
  title: string;
  description?: string;
  priority?: EditorialTaskPriority;
  assignee?: string | null;
  createdBy: string;
};

export function validateCreateTaskInput(
  raw: unknown,
):
  | { ok: true; input: CreateEditorialTaskInput }
  | { ok: false; error: TaskErrorCode; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "INVALID_INPUT", message: "Invalid payload." };
  }
  const o = raw as Record<string, unknown>;
  const entityType = o.entityType;
  const entityId = o.entityId;
  const sourceType = o.sourceType;
  const title = o.title;
  const createdBy = o.createdBy;

  if (
    entityType !== "product" &&
    entityType !== "article" &&
    entityType !== "topic"
  ) {
    return { ok: false, error: "INVALID_INPUT", message: "Invalid entityType." };
  }
  if (typeof entityId !== "string" || !entityId.trim()) {
    return { ok: false, error: "INVALID_INPUT", message: "entityId required." };
  }
  if (
    sourceType !== "ai-recommendation" &&
    sourceType !== "ai-suggestion" &&
    sourceType !== "manual"
  ) {
    return { ok: false, error: "INVALID_INPUT", message: "Invalid sourceType." };
  }
  if (typeof title !== "string" || !title.trim()) {
    return { ok: false, error: "INVALID_INPUT", message: "title required." };
  }
  if (typeof createdBy !== "string" || !createdBy.trim()) {
    return { ok: false, error: "INVALID_INPUT", message: "createdBy required." };
  }

  const priority = o.priority;
  const resolvedPriority: EditorialTaskPriority =
    priority === "high" || priority === "medium" || priority === "low"
      ? priority
      : "medium";

  return {
    ok: true,
    input: {
      entityType,
      entityId: entityId.trim(),
      sourceType,
      sourceId:
        typeof o.sourceId === "string" && o.sourceId.trim()
          ? o.sourceId.trim()
          : null,
      title: title.trim(),
      description:
        typeof o.description === "string" ? o.description.trim() : "",
      priority: resolvedPriority,
      assignee:
        typeof o.assignee === "string" && o.assignee.trim()
          ? o.assignee.trim()
          : null,
      createdBy: createdBy.trim(),
    },
  };
}

async function entityExists(
  entityType: EditorialTaskEntityType,
  entityId: string,
): Promise<boolean> {
  if (entityType === "topic") return true;
  if (entityType === "product") {
    return Boolean(await getAdminProduct(entityId));
  }
  return Boolean(await getAdminArticle(entityId));
}

async function resolveEntityName(
  entityType: EditorialTaskEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === "topic") return entityId;
  if (entityType === "product") {
    const record = await getAdminProduct(entityId);
    return record?.product.identity.name ?? entityId;
  }
  const record = await getAdminArticle(entityId);
  return record?.article.identity.title ?? entityId;
}

function toViewModel(
  record: EditorialTaskRecord,
  entityName: string,
): EditorialTaskViewModel {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    entityName,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    title: record.title,
    description: record.description,
    priority: record.priority,
    status: record.status,
    assignee: record.assignee,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function recordToViewModel(
  record: EditorialTaskRecord,
): Promise<EditorialTaskViewModel> {
  const entityName = await resolveEntityName(record.entityType, record.entityId);
  return toViewModel(record, entityName);
}

export async function findRecommendationById(
  recommendationId: string,
): Promise<AIRecommendationViewModel | undefined> {
  const { items } = await buildAllRecommendations();
  return items.find((r) => r.id === recommendationId);
}

function taskDescriptionFromRecommendation(
  rec: AIRecommendationViewModel,
): string {
  return `${rec.reason}\n\nImpact: ${rec.impact}`;
}

function taskTitleFromRecommendation(rec: AIRecommendationViewModel): string {
  if (rec.recommendationType === "content-coverage") {
    return `Write supporting article for ${rec.entityName}`;
  }
  if (rec.recommendationType === "seo-improvement") {
    return `Review SEO suggestion for ${rec.entityName}`;
  }
  if (rec.recommendationType === "internal-linking") {
    return `Add internal link — ${rec.title}`;
  }
  return rec.title;
}

export async function createEditorialTask(
  input: unknown,
): Promise<TaskResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "Editorial tasks require CONTENT_STORE=database.",
    };
  }

  const parsed = validateCreateTaskInput(input);
  if (!parsed.ok) {
    return {
      success: false,
      error: parsed.error,
      message: parsed.message,
    };
  }

  if (!(await entityExists(parsed.input.entityType, parsed.input.entityId))) {
    return {
      success: false,
      error: "ENTITY_NOT_FOUND",
      message: `Entity not found: ${parsed.input.entityType}/${parsed.input.entityId}`,
    };
  }

  const record = await insertEditorialTask({
    entityType: parsed.input.entityType,
    entityId: parsed.input.entityId,
    sourceType: parsed.input.sourceType,
    sourceId: parsed.input.sourceId ?? null,
    title: parsed.input.title,
    description: parsed.input.description ?? "",
    priority: parsed.input.priority ?? "medium",
    createdBy: parsed.input.createdBy,
    assignee: parsed.input.assignee ?? null,
  });

  return {
    success: true,
    task: await recordToViewModel(record),
  };
}

export async function createTaskFromRecommendation(input: {
  recommendationId: string;
  createdBy: string;
  assignee?: string | null;
}): Promise<TaskResult> {
  const rec = await findRecommendationById(input.recommendationId);
  if (!rec) {
    return {
      success: false,
      error: "SOURCE_NOT_FOUND",
      message: `Recommendation not found: ${input.recommendationId}`,
    };
  }

  return createEditorialTask({
    entityType: rec.entityType,
    entityId: rec.entityId,
    sourceType: "ai-recommendation",
    sourceId: rec.id,
    title: taskTitleFromRecommendation(rec),
    description: taskDescriptionFromRecommendation(rec),
    priority: rec.priority,
    assignee: input.assignee ?? null,
    createdBy: input.createdBy,
  });
}

export async function createTaskFromSuggestion(input: {
  suggestionId: string;
  createdBy: string;
  assignee?: string | null;
}): Promise<TaskResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "Editorial tasks require CONTENT_STORE=database.",
    };
  }

  const suggestion = await findAISuggestionById(input.suggestionId);
  if (!suggestion) {
    return {
      success: false,
      error: "SOURCE_NOT_FOUND",
      message: `Suggestion not found: ${input.suggestionId}`,
    };
  }

  const title =
    suggestion.suggestionType === "seo"
      ? `Review SEO ${suggestion.targetField} suggestion`
      : `Review ${suggestion.suggestionType} suggestion — ${suggestion.targetField}`;

  return createEditorialTask({
    entityType: suggestion.entityType,
    entityId: suggestion.entityId,
    sourceType: "ai-suggestion",
    sourceId: suggestion.id,
    title,
    description: suggestion.reasoning,
    priority:
      suggestion.confidence >= 75
        ? "high"
        : suggestion.confidence >= 45
          ? "medium"
          : "low",
    assignee: input.assignee ?? null,
    createdBy: input.createdBy,
  });
}

export async function getTasks(
  limit = 200,
): Promise<EditorialTaskViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listAllEditorialTasks(limit);
  return Promise.all(rows.map((r) => recordToViewModel(r)));
}

export async function getEntityTasks(
  entityType: EditorialTaskEntityType,
  entityId: string,
): Promise<EditorialTaskViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listEditorialTasksByEntity(entityType, entityId);
  return Promise.all(rows.map((r) => recordToViewModel(r)));
}

export async function getTaskQueue(
  limit = 100,
): Promise<EditorialTaskQueueViewModel> {
  const items = (await getTasks(limit)).filter(
    (t) => t.status !== "cancelled" || limit > 50,
  );
  const active = items.slice(0, limit);

  const open = active.filter((t) => t.status === "open");
  const inProgress = active.filter((t) => t.status === "in-progress");
  const review = active.filter((t) => t.status === "review");
  const completed = active.filter((t) => t.status === "completed");
  const cancelled = active.filter((t) => t.status === "cancelled");

  return {
    openCount: open.length,
    inProgressCount: inProgress.length,
    reviewCount: review.length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    items: active,
    byStatus: {
      open,
      "in-progress": inProgress,
      review,
      completed,
      cancelled,
    },
  };
}

export async function assignTask(input: {
  taskId: string;
  assignee: string;
}): Promise<TaskResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "Editorial tasks require CONTENT_STORE=database.",
    };
  }
  if (!input.assignee?.trim()) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "assignee required.",
    };
  }

  const existing = await findEditorialTaskById(input.taskId);
  if (!existing) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Task not found: ${input.taskId}`,
    };
  }
  if (existing.status === "completed" || existing.status === "cancelled") {
    return {
      success: false,
      error: "INVALID_TRANSITION",
      message: `Cannot assign task in status ${existing.status}.`,
    };
  }

  const updated = await updateEditorialTaskFields({
    id: input.taskId,
    assignee: input.assignee.trim(),
  });
  if (!updated) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Task not found: ${input.taskId}`,
    };
  }

  return { success: true, task: await recordToViewModel(updated) };
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: EditorialTaskStatus;
}): Promise<TaskResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "Editorial tasks require CONTENT_STORE=database.",
    };
  }
  if (!TASK_STATUSES.includes(input.status)) {
    return {
      success: false,
      error: "INVALID_STATUS",
      message: `Invalid status: ${input.status}`,
    };
  }

  const existing = await findEditorialTaskById(input.taskId);
  if (!existing) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Task not found: ${input.taskId}`,
    };
  }

  if (
    input.status !== existing.status &&
    !isValidTaskTransition(existing.status, input.status)
  ) {
    return {
      success: false,
      error: "INVALID_TRANSITION",
      message: `Cannot transition from ${existing.status} to ${input.status}.`,
    };
  }

  const updated = await updateEditorialTaskFields({
    id: input.taskId,
    status: input.status,
  });
  if (!updated) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Task not found: ${input.taskId}`,
    };
  }

  return { success: true, task: await recordToViewModel(updated) };
}

/** Marks task completed — does NOT mutate canonical content or accept suggestions. */
export async function completeTask(taskId: string): Promise<TaskResult> {
  return updateTaskStatus({ taskId, status: "completed" });
}

export { deleteEditorialTasksForEntityForTests };

export type {
  EditorialTaskViewModel,
  EditorialTaskQueueViewModel,
  EditorialTaskStatus,
};
