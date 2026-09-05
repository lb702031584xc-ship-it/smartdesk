"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveEditorialWorkflowAction,
  createEditorialWorkflowAction,
  publishEditorialWorkflowAction,
  reopenEditorialWorkflowAction,
  submitEditorialWorkflowAction,
} from "@/lib/admin/actions";
import { AdminSection } from "@/components/admin/AdminSection";
import type {
  EditorialWorkflowEntityType,
  EditorialWorkflowRole,
  EditorialWorkflowView,
} from "@/types/editorial-workflow";

type EditorialWorkflowPanelProps = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityLabel: string;
  initialWorkflow: EditorialWorkflowView | null;
  /** Roles resolved server-side from admin auth config. */
  roles: EditorialWorkflowRole[];
};

/**
 * Read/control UI for Phase 36 editorial workflow.
 * No content editing controls.
 */
export function EditorialWorkflowPanel({
  entityType,
  entityId,
  entityLabel,
  initialWorkflow,
  roles,
}: EditorialWorkflowPanelProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isEditor = roles.includes("editor");
  const isReviewer = roles.includes("reviewer");
  const status = workflow?.record.status;

  function run(
    label: string,
    action: () => Promise<
      | { success: true; workflow: EditorialWorkflowView }
      | { success: false; error: string; message: string }
    >,
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      setWorkflow(result.workflow);
      setMessage(`${label} → ${result.workflow.record.status}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Editorial workflow
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Review control for{" "}
          <span className="font-medium text-[var(--ink)]">{entityLabel}</span>
          . Mutations stay on their existing paths; this layer tracks approval.
        </p>
        <p className="mt-1 text-xs text-[var(--subtle)]">
          {entityType} · {entityId} · roles: {roles.join(", ") || "none"}
        </p>
      </div>

      <AdminSection title="Current status">
        <p className="text-3xl font-semibold capitalize text-[var(--ink)]">
          {status ?? "none"}
        </p>
        {workflow ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Updated by {workflow.record.updatedBy} ·{" "}
            {new Date(workflow.record.updatedAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No workflow yet. Create a draft to start review.
          </p>
        )}
      </AdminSection>

      <AdminSection
        title="Actions"
        description="Editor: create / submit / reopen. Reviewer: approve / publish."
      >
        <div className="flex flex-wrap gap-2">
          {!workflow ? (
            <button
              type="button"
              disabled={pending || !isEditor}
              onClick={() =>
                run("Create", () =>
                  createEditorialWorkflowAction(entityType, entityId),
                )
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Create draft workflow
            </button>
          ) : null}
          {status === "draft" ? (
            <button
              type="button"
              disabled={pending || !isEditor}
              onClick={() =>
                run("Submit review", () =>
                  submitEditorialWorkflowAction(entityType, entityId),
                )
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Submit review
            </button>
          ) : null}
          {status === "review" ? (
            <button
              type="button"
              disabled={pending || !isReviewer}
              onClick={() =>
                run("Approve", () =>
                  approveEditorialWorkflowAction(entityType, entityId),
                )
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
          ) : null}
          {status === "approved" ? (
            <button
              type="button"
              disabled={pending || !isReviewer}
              onClick={() =>
                run("Publish", () =>
                  publishEditorialWorkflowAction(entityType, entityId),
                )
              }
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Publish
            </button>
          ) : null}
          {status === "published" ? (
            <button
              type="button"
              disabled={pending || !isEditor}
              onClick={() =>
                run("Reopen", () =>
                  reopenEditorialWorkflowAction(entityType, entityId),
                )
              }
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
            >
              Reopen draft
            </button>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title="History" description="Append-only audit trail.">
        {!workflow || workflow.history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {workflow.history.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-[var(--line)] px-3 py-2"
              >
                <p className="font-medium text-[var(--ink)]">
                  {event.action}: {event.previousStatus ?? "—"} → {event.newStatus}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {event.actor} · {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {message}
        </p>
      ) : null}
    </div>
  );
}
