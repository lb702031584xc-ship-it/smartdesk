"use client";

import { useState, useTransition } from "react";
import {
  exportEvaluationDatasetAction,
  materializeEvaluationSnapshotsAction,
} from "@/lib/admin/actions";

/**
 * Admin-only Evaluation Dataset export (summary CSV by default).
 * Terminology: Evaluation Export — not training dataset.
 */
export function EvaluationExportButtons() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function download(mode: "summary" | "detailed") {
    setMessage(null);
    startTransition(async () => {
      const result = await exportEvaluationDatasetAction(mode);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${result.filename}`);
    });
  }

  function materialize() {
    setMessage(null);
    startTransition(async () => {
      const result = await materializeEvaluationSnapshotsAction();
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setMessage(`Materialized ${result.count} evaluation snapshot(s).`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => download("summary")}
        className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Export evaluation CSV (summary)
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => download("detailed")}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
      >
        Export detailed
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={materialize}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
      >
        Materialize snapshots
      </button>
      {message ? (
        <p className="w-full text-xs text-[var(--muted)]">{message}</p>
      ) : null}
    </div>
  );
}
