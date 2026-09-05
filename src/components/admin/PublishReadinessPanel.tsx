"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArticleV1 } from "@/types/article-v1";
import type { ArticleReadinessResult, ReadinessCheck } from "@/lib/editorial/article-readiness";
import { evaluateArticleReadinessAction } from "@/lib/admin/actions";

export function PublishReadinessPanel({
  draft,
  body,
}: {
  draft: ArticleV1;
  body: string;
}) {
  const [result, setResult] = useState<ArticleReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassed, setShowPassed] = useState(false);

  const key = useMemo(() => JSON.stringify({ d: draft, b: body }), [draft, body]);

  useEffect(() => {
    setResult(null);
  }, [key]);

  async function evaluate() {
    setLoading(true);
    const r = await evaluateArticleReadinessAction(draft, body);
    setResult(r);
    setLoading(false);
  }

  if (!result && !loading) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">Publish Readiness</h3>
        <button
          type="button"
          onClick={() => void evaluate()}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-gray-50"
        >
          Check readiness
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">Publish Readiness</h3>
        <p className="text-xs text-[var(--muted)]">Evaluating…</p>
      </div>
    );
  }

  if (!result) return null;

  const passed = result.checks.filter((c) => c.severity === "pass");
  const infos = result.checks.filter((c) => c.severity === "info");

  const sections = new Map<string, ReadinessCheck[]>();
  for (const check of [...result.blockers, ...result.warnings]) {
    const sec = check.section ?? "Other";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(check);
  }

  return (
    <div className={`rounded-lg border p-4 ${result.ready ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          {result.ready ? "Ready to publish" : "Not ready"}
        </h3>
        <button
          type="button"
          onClick={() => void evaluate()}
          className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
        >
          Recheck
        </button>
      </div>

      <p className="mb-3 text-xs text-[var(--muted)]">
        {result.checks.length} checks · {result.blockers.length} blockers · {result.warnings.length} warnings · {passed.length} passed
      </p>

      {result.blockers.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold text-red-800">Blockers</p>
          {result.blockers.map((c) => (
            <CheckItem key={c.id} check={c} />
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold text-amber-800">Warnings</p>
          {result.warnings.map((c) => (
            <CheckItem key={c.id} check={c} />
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div className="mb-3">
          {infos.map((c) => (
            <p key={c.id} className="text-xs text-[var(--muted)]">{c.label}: {c.message}</p>
          ))}
        </div>
      )}

      {passed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPassed(!showPassed)}
            className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
          >
            {showPassed ? "Hide" : "View"} {passed.length} passed checks
          </button>
          {showPassed && (
            <div className="mt-1">
              {passed.map((c) => (
                <CheckItem key={c.id} check={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckItem({ check }: { check: ReadinessCheck }) {
  const colors = {
    blocker: "text-red-800",
    warning: "text-amber-800",
    pass: "text-green-800",
    info: "text-[var(--muted)]",
  };
  const icons = {
    blocker: "✕",
    warning: "⚠",
    pass: "✓",
    info: "ℹ",
  };
  return (
    <p className={`text-xs ${colors[check.severity]}`}>
      {icons[check.severity]} {check.message}
    </p>
  );
}
