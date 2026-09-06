"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  assignEditorialTaskAction,
  completeEditorialTaskAction,
  createEditorialTaskAction,
  createTaskFromRecommendationAction,
  createTaskFromSuggestionAction,
  updateEditorialTaskStatusAction,
} from "@/lib/admin/actions";
import { editorialWorkspaceHref } from "@/lib/editorial-workspace-links";
import type {
  EditorialTaskEntityType,
  EditorialTaskQueueViewModel,
  EditorialTaskSourceType,
  EditorialTaskStatus,
  EditorialTaskViewModel,
} from "@/types/editorial-task";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

const STATUS_TONES: Record<
  EditorialTaskStatus,
  "neutral" | "ok" | "warn" | "bad"
> = {
  open: "warn",
  "in-progress": "neutral",
  review: "warn",
  completed: "ok",
  cancelled: "bad",
};

const SOURCE_LABELS: Record<EditorialTaskSourceType, string> = {
  "ai-recommendation": "AI Recommendation",
  "ai-suggestion": "AI Suggestion",
  "ai-assistance": "AI Assistance",
  manual: "Manual",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function entityHref(
  entityType: EditorialTaskEntityType,
  entityId: string,
): string | null {
  if (entityType === "topic") {
    return `/dashboard/intelligence/topics#${encodeURIComponent(entityId)}`;
  }
  return editorialWorkspaceHref(entityType, entityId);
}

function TaskCard({
  task,
  showEntityLink,
  actorEmail,
}: {
  task: EditorialTaskViewModel;
  showEntityLink?: boolean;
  actorEmail?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const terminal =
    task.status === "completed" || task.status === "cancelled";

  function run(
    action: () => Promise<
      | { success: true }
      | { success: false; error: string; message: string }
    >,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      router.refresh();
    });
  }

  const href = entityHref(task.entityType, task.entityId);

  return (
    <li className="rounded-md border border-[var(--line)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--ink)]">{task.title}</p>
          {showEntityLink && href ? (
            <p className="text-xs text-[var(--subtle)]">
              <Link href={href} className="underline-offset-2 hover:underline">
                {task.entityName}
              </Link>
            </p>
          ) : (
            <p className="text-xs text-[var(--subtle)]">{task.entityName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <SignalBadge label={task.priority} tone="neutral" />
          <SignalBadge label={task.status} tone={STATUS_TONES[task.status]} />
          <SignalBadge label={SOURCE_LABELS[task.sourceType]} tone="neutral" />
        </div>
      </div>

      {task.description ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{task.description}</p>
      ) : null}

      <p className="mt-2 text-xs text-[var(--subtle)]">
        {task.assignee ? `Assigned to ${task.assignee}` : "Unassigned"}
        {" · "}
        {task.createdBy}
        {" · "}
        {formatWhen(task.createdAt)}
      </p>

      {task.sourceType === "ai-recommendation" && task.sourceId ? (
        <p className="mt-1 text-xs">
          <Link
            href="/dashboard/intelligence/recommendations"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Source recommendation
          </Link>
        </p>
      ) : null}
      {task.sourceType === "ai-suggestion" && task.sourceId ? (
        <p className="mt-1 text-xs">
          <Link
            href="/dashboard/intelligence/ai"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Source AI suggestion — review separately
          </Link>
        </p>
      ) : null}
      {task.sourceType === "ai-assistance" && task.sourceId ? (
        <p className="mt-1 text-xs">
          <Link
            href={`/dashboard/intelligence/ai-evaluation/${task.sourceId}`}
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Source AI assistance evaluation
          </Link>
        </p>
      ) : null}

      {!terminal ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.status === "open" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateEditorialTaskStatusAction(task.id, "in-progress"),
                )
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Start
            </button>
          ) : null}
          {task.status === "in-progress" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => updateEditorialTaskStatusAction(task.id, "review"))
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Send to review
            </button>
          ) : null}
          {task.status === "review" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => completeEditorialTaskAction(task.id))}
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Complete
            </button>
          ) : null}
          {actorEmail ? (
            <button
              type="button"
              disabled={pending || task.assignee === actorEmail}
              onClick={() =>
                run(() =>
                  assignEditorialTaskAction(task.id, actorEmail),
                )
              }
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
            >
              Assign to me
            </button>
          ) : null}
          {!terminal && task.status !== "cancelled" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateEditorialTaskStatusAction(task.id, "cancelled"),
                )
              }
              className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)] disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ManualCreateForm({
  entityType,
  entityId,
}: {
  entityType: EditorialTaskEntityType;
  entityId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEditorialTaskAction({
        entityType,
        entityId,
        sourceType: "manual",
        title,
        description,
        priority: "medium",
      });
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      setTitle("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-[var(--line)] pt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
        Create manual task
      </p>
      <div className="space-y-2">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Create task
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-900">{error}</p>
      ) : null}
    </form>
  );
}

export function EditorialTaskEntityPanel({
  tasks,
  entityType,
  entityId,
  actorEmail,
}: {
  tasks: EditorialTaskViewModel[];
  entityType: EditorialTaskEntityType;
  entityId: string;
  actorEmail?: string;
}) {
  const active = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled",
  );
  const done = tasks.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  );

  return (
    <IntelligenceSection
      title="Editorial Tasks"
      description="Track operational work. Completing a task does not mutate content or accept AI suggestions."
    >
      {active.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active tasks.</p>
      ) : (
        <ul className="space-y-3">
          {active.map((task) => (
            <TaskCard key={task.id} task={task} actorEmail={actorEmail} />
          ))}
        </ul>
      )}
      {done.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Completed / cancelled
          </p>
          <ul className="space-y-2">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ) : null}
      <ManualCreateForm entityType={entityType} entityId={entityId} />
      <p className="mt-3 text-sm">
        <Link
          href="/dashboard/editorial/tasks"
          className="text-[var(--muted)] underline-offset-2 hover:underline"
        >
          View all editorial tasks
        </Link>
      </p>
    </IntelligenceSection>
  );
}

export function EditorialTaskQueuePanel({
  queue,
  actorEmail,
  sourceFilter,
}: {
  queue: EditorialTaskQueueViewModel;
  actorEmail?: string;
  sourceFilter?: EditorialTaskSourceType | "all";
}) {
  const filtered =
    sourceFilter && sourceFilter !== "all"
      ? queue.items.filter((t) => t.sourceType === sourceFilter)
      : queue.items;

  if (filtered.length === 0) {
    return (
      <IntelligenceSection title="Editorial Tasks">
        <IntelligenceEmptyState message="No editorial tasks match this filter." />
      </IntelligenceSection>
    );
  }

  const byStatus = {
    open: filtered.filter((t) => t.status === "open"),
    "in-progress": filtered.filter((t) => t.status === "in-progress"),
    review: filtered.filter((t) => t.status === "review"),
    completed: filtered.filter((t) => t.status === "completed"),
  };

  return (
    <IntelligenceSection
      title="Editorial Tasks"
      description={`${filtered.length} task(s). Operational tracking only — no automatic content changes.`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <SignalBadge label={`Open ${byStatus.open.length}`} tone="warn" />
        <SignalBadge
          label={`In Progress ${byStatus["in-progress"].length}`}
          tone="neutral"
        />
        <SignalBadge label={`Review ${byStatus.review.length}`} tone="warn" />
        <SignalBadge
          label={`Completed ${byStatus.completed.length}`}
          tone="ok"
        />
      </div>
      <div className="space-y-6">
        {(["open", "in-progress", "review", "completed"] as const).map(
          (status) =>
            byStatus[status].length > 0 ? (
              <div key={status}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--subtle)]">
                  {status.replace("-", " ")}
                </h3>
                <ul className="space-y-3">
                  {byStatus[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      showEntityLink
                      actorEmail={actorEmail}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
        )}
      </div>
    </IntelligenceSection>
  );
}

export function CreateTaskFromRecommendationButton({
  recommendationId,
}: {
  recommendationId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending || done}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result =
              await createTaskFromRecommendationAction(recommendationId);
            if (!result.success) {
              setError(`${result.error}: ${result.message}`);
              return;
            }
            setDone(true);
            router.refresh();
          });
        }}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
      >
        {done ? "Task created" : "Create task"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-900">{error}</p>
      ) : null}
    </div>
  );
}

export function CreateTaskFromSuggestionButton({
  suggestionId,
}: {
  suggestionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending || done}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createTaskFromSuggestionAction(suggestionId);
            if (!result.success) {
              setError(`${result.error}: ${result.message}`);
              return;
            }
            setDone(true);
            router.refresh();
          });
        }}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
      >
        {done ? "Task created" : "Create task"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-900">{error}</p>
      ) : null}
    </div>
  );
}
