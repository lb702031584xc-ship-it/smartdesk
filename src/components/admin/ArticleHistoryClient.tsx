"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadArticleRevisionDetailAction,
  previewAdminArticleMarkdownAction,
  restoreArticleRevisionAction,
} from "@/lib/admin/actions";
import type { RevisionListItem } from "@/lib/admin/revision-store";
import type { ArticleV1 } from "@/types/article-v1";

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      revisionNumber: number;
      createdAt: string;
      createdBy: string;
      changedSections: string[];
      data: ArticleV1;
      body: string;
      previewHtml: string;
    }
  | { status: "error"; message: string };

export function ArticleHistoryClient({
  articleId,
  title,
  currentVersion,
  revisions,
}: {
  articleId: string;
  title: string;
  currentVersion?: number;
  revisions: RevisionListItem[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ status: "idle" });
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [bodyView, setBodyView] = useState<"markdown" | "preview">("markdown");
  const [showRawJson, setShowRawJson] = useState(false);

  const selected = useMemo(
    () => revisions.find((revision) => revision.id === selectedId),
    [revisions, selectedId],
  );

  async function openRevision(revisionId: string) {
    setSelectedId(revisionId);
    setDetail({ status: "loading" });
    setRestoreOpen(false);
    setRestoreResult(null);

    const loaded = await loadArticleRevisionDetailAction(articleId, revisionId);
    if ("error" in loaded) {
      setDetail({ status: "error", message: loaded.error });
      return;
    }

    const preview = await previewAdminArticleMarkdownAction(loaded.body);
    setDetail({
      status: "ready",
      revisionNumber: loaded.revisionNumber,
      createdAt: loaded.createdAt,
      createdBy: loaded.createdBy,
      changedSections: loaded.changedSections,
      data: loaded.data,
      body: loaded.body,
      previewHtml: preview.ok ? preview.html : "",
    });
  }

  async function confirmRestore() {
    if (!selectedId || currentVersion === undefined) return;
    const result = await restoreArticleRevisionAction(articleId, selectedId, currentVersion);
    if (result.ok) {
      router.push(`/admin/articles/${articleId}?restored=1`);
      router.refresh();
      return;
    }
    setRestoreResult(result.errors.join(" ") || "Restore failed.");
    setRestoreOpen(false);
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Revision history</h2>
          <p className="text-sm text-[var(--muted)]">{title}</p>
        </div>
        {revisions.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">No revisions yet.</p>
        ) : (
          <ul>
            {revisions.map((revision) => (
              <li key={revision.id} className="border-b border-[var(--line)] last:border-0">
                <button
                  type="button"
                  onClick={() => openRevision(revision.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-[var(--canvas)] ${
                    selectedId === revision.id ? "bg-[var(--canvas)]" : ""
                  }`}
                >
                  <p className="font-medium text-[var(--ink)]">Revision #{revision.revisionNumber}</p>
                  <p className="text-xs text-[var(--subtle)]">
                    {new Date(revision.createdAt).toLocaleString()} · {revision.createdBy}
                  </p>
                  {revision.changedSections.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                      {revision.changedSections.slice(0, 4).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-4">
        {detail.status === "idle" ? (
          <p className="text-sm text-[var(--muted)]">Select a revision to inspect or restore.</p>
        ) : null}
        {detail.status === "loading" ? (
          <p className="text-sm text-[var(--muted)]">Loading revision…</p>
        ) : null}
        {detail.status === "error" ? (
          <p className="text-sm text-red-700">{detail.message}</p>
        ) : null}
        {detail.status === "ready" ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ink)]">
                  Revision #{detail.revisionNumber}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  {new Date(detail.createdAt).toLocaleString()} · {detail.createdBy}
                </p>
              </div>
              {currentVersion !== undefined ? (
                <button
                  type="button"
                  onClick={() => setRestoreOpen(true)}
                  className="rounded-md bg-[var(--ink)] px-3 py-2 text-sm font-medium text-white"
                >
                  Restore this revision
                </button>
              ) : null}
            </div>

            {detail.changedSections.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-medium text-[var(--ink)]">Changed in next version</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-[var(--muted)]">
                  {detail.changedSections.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4">
              <p className="text-sm font-medium text-[var(--ink)]">Article body</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBodyView("markdown")}
                  className={`rounded px-2 py-1 text-xs ring-1 ring-[var(--line)] ${
                    bodyView === "markdown" ? "bg-[var(--canvas)]" : ""
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setBodyView("preview")}
                  className={`rounded px-2 py-1 text-xs ring-1 ring-[var(--line)] ${
                    bodyView === "preview" ? "bg-[var(--canvas)]" : ""
                  }`}
                >
                  Preview
                </button>
              </div>
              {bodyView === "markdown" ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-[var(--line)] bg-[var(--canvas)] p-3 text-xs whitespace-pre-wrap">
                  {detail.body || "(empty)"}
                </pre>
              ) : (
                <div
                  className="prose prose-sm mt-2 max-h-64 overflow-auto rounded border border-[var(--line)] bg-white p-3"
                  dangerouslySetInnerHTML={{ __html: detail.previewHtml }}
                />
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowRawJson((value) => !value)}
                className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
              >
                {showRawJson ? "Hide raw JSON" : "View raw JSON"}
              </button>
              {showRawJson ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-[var(--line)] bg-[var(--canvas)] p-3 text-xs">
                  {JSON.stringify(detail.data, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        ) : null}

        {restoreResult ? (
          <p className="mt-4 text-sm text-red-700">{restoreResult}</p>
        ) : null}
      </section>

      {restoreOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h4 className="text-lg font-semibold text-[var(--ink)]">
              Restore revision #{selected.revisionNumber}?
            </h4>
            <p className="mt-2 text-sm text-[var(--muted)]">
              The current version will first be preserved in history.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreOpen(false)}
                className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="rounded-md bg-[var(--ink)] px-3 py-2 text-sm font-medium text-white"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="lg:col-span-2 text-sm">
        <Link href={`/admin/articles/${articleId}`} className="underline-offset-2 hover:underline">
          ← Back to editor
        </Link>
      </p>
    </div>
  );
}
