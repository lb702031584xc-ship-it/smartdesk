import React from "react";
import type { ContentEditorViewModel } from "@/types/content-editor";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

/**
 * Read-only structured content preview for Phase 39 workspace.
 * No save controls — mutations go through content-mutations boundary.
 */
export function ContentStructurePanel({
  editor,
}: {
  editor: ContentEditorViewModel;
}) {
  return (
    <IntelligenceSection
      title="Structured content"
      description="Parsed from Markdown body. View model only — canonical storage unchanged."
    >
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <SignalBadge
          label={`${editor.blockCount} block(s)`}
          tone="neutral"
        />
        {editor.blockTypes.map((type) => (
          <SignalBadge key={type} label={type} tone="neutral" />
        ))}
        <SignalBadge
          label={
            editor.validationStatus === "valid" ? "valid" : "invalid blocks"
          }
          tone={editor.validationStatus === "valid" ? "ok" : "bad"}
        />
        <SignalBadge
          label={
            editor.mutationAllowed ? "mutation: draft" : "mutation: locked"
          }
          tone={editor.mutationAllowed ? "ok" : "warn"}
        />
      </div>

      {editor.validationErrors.length > 0 ? (
        <ul className="mb-4 space-y-1 text-sm text-red-800">
          {editor.validationErrors.map((err, i) => (
            <li key={`${err.blockId ?? "global"}-${i}`}>
              {err.blockId ? `${err.blockId}: ` : ""}
              {err.message}
            </li>
          ))}
        </ul>
      ) : null}

      {editor.parseWarnings.length > 0 ? (
        <ul className="mb-4 space-y-1 text-xs text-[var(--muted)]">
          {editor.parseWarnings.map((w) => (
            <li key={w}>Parse: {w}</li>
          ))}
        </ul>
      ) : null}

      {editor.blocks.length === 0 ? (
        <IntelligenceEmptyState message="No structured blocks parsed from body yet." />
      ) : (
        <ul className="space-y-3">
          {editor.blocks.map((block) => (
            <li
              key={block.id}
              className="rounded-md border border-[var(--line)] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--ink)]">{block.type}</span>
                <span className="text-xs text-[var(--subtle)]">{block.id}</span>
              </div>
              {block.type === "heading" ? (
                <p className="mt-2 text-[var(--ink)]">
                  H{block.level}: {block.content}
                </p>
              ) : null}
              {block.type === "paragraph" ? (
                <p className="mt-2 line-clamp-3 text-[var(--muted)]">
                  {block.content}
                </p>
              ) : null}
              {block.type === "product-reference" ? (
                <p className="mt-2 text-[var(--muted)]">
                  productId:{" "}
                  <span className="font-mono text-[var(--ink)]">
                    {block.productId}
                  </span>
                  {block.heading ? ` · ${block.heading}` : ""}
                </p>
              ) : null}
              {block.type === "comparison-table" ? (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
                  {block.markdown}
                </pre>
              ) : null}
              {block.type === "pros-cons" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-[var(--muted)]">
                  <div>
                    <p className="font-medium text-[var(--ink)]">Pros</p>
                    <ul className="mt-1 list-disc pl-4">
                      {block.pros.slice(0, 4).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--ink)]">Cons</p>
                    <ul className="mt-1 list-disc pl-4">
                      {block.cons.slice(0, 4).map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              {block.type === "callout" ? (
                <p className="mt-2 line-clamp-3 text-[var(--muted)]">
                  [{block.variant}] {block.content}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editor.products.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Article product refs (ArticleV1)
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            {editor.products.map((p) => (
              <li key={p.productId}>
                {p.name}{" "}
                <span className="font-mono text-xs">({p.productId})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </IntelligenceSection>
  );
}
