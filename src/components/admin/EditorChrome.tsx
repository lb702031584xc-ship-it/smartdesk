"use client";

import { useState, type ReactNode } from "react";
import type { AdminSaveResult, AdminWriteMode } from "@/lib/admin/types";
import type { ChangeLine } from "@/lib/admin/change-summary";
import { classifySaveFailure } from "@/lib/admin/save-feedback";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

export function EditorToolbar({
  title,
  subtitle,
  badge,
  dirty,
  status,
  savedAt,
  writeMode,
  writeEnabled,
  previewHref,
  historyHref,
  historyCount,
  stale,
  variant = "save",
  createLabel = "Create",
  statusDetail,
  onSave,
  onReset,
  onReload,
  onCopyJson,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  dirty: boolean;
  status: SaveStatus;
  savedAt?: string;
  writeMode: AdminWriteMode;
  writeEnabled: boolean;
  previewHref?: string;
  historyHref?: string;
  historyCount?: number;
  stale?: boolean;
  variant?: "save" | "create";
  createLabel?: string;
  statusDetail?: string;
  onSave: () => void;
  onReset: () => void;
  onReload: () => void;
  onCopyJson?: () => void;
}) {
  const isCreate = variant === "create";
  const label = isCreate
    ? status === "saving"
      ? "Creating..."
      : status === "saved"
        ? "Created"
        : status === "failed"
          ? "Create failed"
          : createLabel
    : status === "saving"
      ? "Saving..."
      : status === "saved"
        ? savedAt
          ? `Saved ${savedAt}`
          : "Saved"
        : status === "failed"
          ? "Save failed"
          : "Save changes";
  const saveEnabled = writeEnabled && status !== "saving" && (isCreate || dirty);

  return (
    <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] bg-[var(--paper)] py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        {badge ? <div className="mt-2">{badge}</div> : null}
        {dirty ? (
          <p className="mt-1 text-sm font-medium text-amber-800">
            {isCreate ? "Unsaved product" : "Unsaved changes"}
          </p>
        ) : statusDetail ? (
          <p
            className={`mt-1 text-sm font-medium ${
              statusDetail.includes("failed") ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            {statusDetail}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--subtle)]">
            {isCreate ? "Empty product candidate" : "No unsaved changes"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {previewHref ? (
          <a
            href={previewHref}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)] hover:bg-white"
          >
            View article
          </a>
        ) : null}
        {historyHref ? (
          <a
            href={historyHref}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)] hover:bg-white"
          >
            History{typeof historyCount === "number" ? ` (${historyCount})` : ""}
          </a>
        ) : null}
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty}
          className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)] disabled:opacity-50"
        >
          {isCreate ? "Reset form" : "Reset changes"}
        </button>
        {!isCreate && stale ? (
          <button
            type="button"
            onClick={onReload}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-amber-300"
          >
            Reload latest
          </button>
        ) : null}
        {stale && onCopyJson ? (
          <button
            type="button"
            onClick={onCopyJson}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)]"
          >
            Copy my unsaved JSON
          </button>
        ) : null}
        <p className="text-xs text-[var(--subtle)]">Write mode: {writeMode}</p>
        <button
          type="button"
          onClick={onSave}
          disabled={!saveEnabled}
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

export function ValidationSummary({
  result,
  localErrors = [],
  localWarnings = [],
  stale,
  onReload,
  onCopyJson,
}: {
  result: AdminSaveResult | null;
  localErrors?: string[];
  localWarnings?: string[];
  stale?: boolean;
  onReload?: () => void;
  onCopyJson?: () => void;
}) {
  const errors = [...localErrors, ...(result?.errors ?? [])];
  const warnings = [...localWarnings, ...(result?.warnings ?? [])];
  const uniqueErrors = [...new Set(errors)];
  const uniqueWarnings = [...new Set(warnings)];
  const failure = classifySaveFailure(uniqueErrors);
  const conflict = stale || failure.kind === "conflict";

  if (!result && uniqueErrors.length === 0 && uniqueWarnings.length === 0) return null;

  if (result?.blocked) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {result.blockedReason ?? "Save is blocked."}
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {conflict ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">This record has changed since you opened it.</p>
          <p className="mt-1">Reload the latest version before saving. Unsaved edits will be discarded unless you copy them first.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onReload ? (
              <button
                type="button"
                onClick={onReload}
                className="rounded-md px-3 py-1.5 text-sm ring-1 ring-amber-300"
              >
                Reload latest
              </button>
            ) : null}
            {onCopyJson ? (
              <button
                type="button"
                onClick={onCopyJson}
                className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)]"
              >
                Copy my unsaved JSON
              </button>
            ) : null}
          </div>
        </div>
      ) : uniqueErrors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <p className="font-semibold">
            {result && !result.ok ? failure.title || "Errors" : "Errors"}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {uniqueErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {uniqueWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {uniqueWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result?.ok && uniqueErrors.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Saved to the configured content store.
        </div>
      ) : null}
    </div>
  );
}

export function ChangeSummary({
  lines,
  highRisk,
}: {
  lines: ChangeLine[];
  highRisk: string[];
}) {
  if (lines.length === 0 && highRisk.length === 0) return null;
  const grouped = new Map<string, string[]>();
  for (const line of lines) {
    grouped.set(line.section, [...(grouped.get(line.section) ?? []), line.detail]);
  }

  return (
    <div className="mb-6 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--ink)]">Review changes</p>
      {highRisk.length > 0 ? (
        <p className="mt-2 font-medium text-amber-800">
          High-risk: {highRisk.join(", ")}
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {[...grouped.entries()].map(([section, details]) => (
          <div key={section}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
              {section}
            </p>
            <ul className="list-disc pl-5 text-[var(--muted)]">
              {details.map((detail) => (
                <li key={`${section}-${detail}`}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreateSummary({
  title = "Product to create",
  fields,
  risks,
}: {
  title?: string;
  fields: Array<{ label: string; value: string }>;
  risks: string[];
}) {
  return (
    <div className="mb-6 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <ul className="mt-2 list-disc pl-5 text-[var(--muted)]">
        {fields.map((field) => (
          <li key={field.label}>
            {field.label}: {field.value || "—"}
          </li>
        ))}
      </ul>
      {risks.length > 0 ? (
        <p className="mt-2 font-medium text-amber-800">High-risk: {risks.join(", ")}</p>
      ) : null}
    </div>
  );
}

export function CanonicalJsonPreview({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-6 rounded-lg border border-[var(--line)] bg-white px-4 py-3"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-medium">View canonical JSON</summary>
      <pre className="mt-3 overflow-x-auto text-xs text-[var(--muted)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
