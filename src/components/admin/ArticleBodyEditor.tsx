"use client";

import { useEffect, useState } from "react";
import { previewAdminArticleMarkdownAction } from "@/lib/admin/actions";
import {
  countArticleBodyCharacters,
  countArticleBodyWords,
  formatCount,
} from "@/lib/admin/article-body";

type BodyTab = "edit" | "preview";

export function ArticleBodyEditor({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<BodyTab>("edit");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const words = countArticleBodyWords(value);
  const characters = countArticleBodyCharacters(value);

  useEffect(() => {
    if (tab !== "preview") return;
    let cancelled = false;
    setPreviewing(true);
    setPreviewError(null);
    void previewAdminArticleMarkdownAction(value).then((result) => {
      if (cancelled) return;
      setPreviewing(false);
      if (!result.ok) {
        setPreviewError(result.error);
        setPreviewHtml("");
        return;
      }
      setPreviewHtml(result.html);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, value]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Article body view"
          className="inline-flex rounded-md border border-[var(--line)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "edit"}
            className={`px-3 py-1.5 text-sm ${
              tab === "edit"
                ? "bg-[var(--ink)] text-white"
                : "bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            onClick={() => setTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={`px-3 py-1.5 text-sm ${
              tab === "preview"
                ? "bg-[var(--ink)] text-white"
                : "bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
        <p className="text-xs text-[var(--subtle)]">
          {formatCount(words)} words · {formatCount(characters)} characters
        </p>
      </div>

      {tab === "edit" ? (
        <>
          <label htmlFor={id} className="sr-only">
            Article Markdown body
          </label>
          <textarea
            id={id}
            value={value}
            disabled={disabled}
            rows={22}
            spellCheck
            onChange={(event) => onChange(event.target.value)}
            className="w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-3 font-mono text-sm leading-relaxed text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--canvas)]"
            placeholder="# Heading&#10;&#10;Write Markdown prose here…"
          />
          <p className="text-xs text-[var(--subtle)]">
            Markdown supported: <code># Heading</code>, <code>**bold**</code>,{" "}
            <code>- list</code>, <code>[link](url)</code>. Preview uses the same
            production renderer. Preview is not publication.
          </p>
        </>
      ) : (
        <div className="min-h-[16rem] rounded-md border border-[var(--line)] bg-white px-4 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Admin preview · not the published page
          </p>
          {previewing ? (
            <p className="text-sm text-[var(--muted)]">Rendering preview…</p>
          ) : previewError ? (
            <p className="text-sm text-red-700">{previewError}</p>
          ) : value.trim() ? (
            <div
              className="prose prose-smartdesk prose-sm max-w-none text-[var(--ink)]"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">Empty body — nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
