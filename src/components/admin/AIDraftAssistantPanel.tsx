"use client";

import { useState } from "react";
import {
  aiAssistArticleAction,
  loadProductsForAIContextAction,
} from "@/lib/admin/actions";
import type { AdminProductOption } from "@/lib/admin/editor-constants";
import { ARTICLE_INTENTS, ARTICLE_TYPES } from "@/lib/admin/editor-constants";
import type {
  AIDraftOutline,
  AIDraftProposal,
  AIProductContext,
} from "@/lib/ai/types";

type DraftStatus = "idle" | "generating" | "ready" | "error";
type DraftMode = "outline" | "draft";

export function AIDraftAssistantPanel({
  productOptions,
  onApplyDraft,
}: {
  productOptions: AdminProductOption[];
  onApplyDraft: (patch: {
    title?: string;
    summary?: string;
    seo?: { metaTitle?: string; metaDescription?: string; primaryKeyword?: string; secondaryKeywords?: string[] };
    faq?: { question: string; answer: string }[];
    productRefs?: { productId: string; summary?: string; verdict?: string; bestFor?: string }[];
    body?: string;
  }) => void;
}) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outline, setOutline] = useState<AIDraftOutline | null>(null);
  const [draft, setDraft] = useState<AIDraftProposal | null>(null);
  const [lastMode, setLastMode] = useState<DraftMode | null>(null);

  // Inputs
  const [articleType, setArticleType] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [intent, setIntent] = useState<string>("");
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");

  const generating = status === "generating";

  async function runGeneration(mode: DraftMode) {
    if (!articleType) { setError("Select an article type first."); setStatus("error"); return; }
    if (!topic.trim()) { setError("Enter a topic or working title."); setStatus("error"); return; }
    setStatus("generating");
    setError(null);
    setOutline(null);
    setDraft(null);
    setLastMode(mode);

    let productContext: AIProductContext[] = [];
    if (selectedProductIds.length > 0) {
      productContext = await loadProductsForAIContextAction(selectedProductIds);
    }

    const result = await aiAssistArticleAction({
      action: mode === "outline" ? "generate-outline" : "generate-draft",
      articleContext: {
        title: topic,
        type: articleType,
        category: category || undefined,
        intent: intent || undefined,
        summary: undefined,
        body: undefined,
        currentSeo: keyword ? { primaryKeyword: keyword } : undefined,
      },
      productContext,
      instruction: instruction.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }

    if (result.action === "generate-outline") {
      setOutline(result.suggestion);
    } else if (result.action === "generate-draft") {
      setDraft(result.suggestion);
    }
    setStatus("ready");
  }

  function handleDiscard() {
    setOutline(null);
    setDraft(null);
    setStatus("idle");
    setError(null);
    setLastMode(null);
  }

  function handleApply() {
    if (outline && lastMode === "outline") {
      onApplyDraft({
        title: outline.titleSuggestion,
        summary: outline.summary,
        seo: outline.seo,
        faq: outline.faq,
        body: outline.sections ? outline.sections.map((s) => `## ${s}\n\n`).join("") : undefined,
      });
    } else if (draft && lastMode === "draft") {
      onApplyDraft({
        title: draft.titleSuggestion,
        summary: draft.summary,
        seo: draft.seo,
        faq: draft.faq,
        productRefs: draft.productRefs,
        body: draft.bodyMarkdown,
      });
    }
    handleDiscard();
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">AI Draft Assistant</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Generate an article outline or full draft proposal. Review before applying.
        Content sent to the configured AI provider. Manual creation works without AI.
      </p>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Article type *</label>
          <select
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            value={articleType}
            onChange={(e) => setArticleType(e.target.value)}
          >
            <option value="">Select type</option>
            {ARTICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Intent</label>
          <select
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          >
            <option value="">Select intent</option>
            {ARTICLE_INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Topic / working title *</label>
        <input
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Best Standing Desks for Small Apartments"
        />
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Category</label>
          <input className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. desks" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Target keyword</label>
          <input className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. standing desk small apartment" />
        </div>
      </div>

      {productOptions.length > 0 && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Select products (optional)</label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--line)] bg-white p-2">
            {productOptions.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 py-0.5 text-xs">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(opt.id)}
                  onChange={() => toggleProduct(opt.id)}
                />
                {opt.name} ({opt.brand})
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Instruction (optional)</label>
        <textarea
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Focus on budget options under $300"
        />
      </div>

      <div className="mb-3 flex gap-2">
        <button type="button" disabled={generating} onClick={() => runGeneration("outline")} className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-gray-50 disabled:opacity-50">Generate outline</button>
        <button type="button" disabled={generating} onClick={() => runGeneration("draft")} className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-gray-50 disabled:opacity-50">Generate draft</button>
      </div>

      {generating && <p className="text-sm text-[var(--muted)]">Generating…</p>}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {outline && (
        <OutlinePreview outline={outline} onApply={handleApply} onDiscard={handleDiscard} />
      )}

      {draft && (
        <DraftPreview draft={draft} onApply={handleApply} onDiscard={handleDiscard} />
      )}
    </div>
  );
}

function OutlinePreview({
  outline,
  onApply,
  onDiscard,
}: {
  outline: AIDraftOutline;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">Outline proposal</p>
      {outline.titleSuggestion && <p className="text-sm"><strong>Title:</strong> {outline.titleSuggestion}</p>}
      {outline.summary && <p className="mt-1 text-xs text-[var(--ink)]"><strong>Summary:</strong> {outline.summary}</p>}
      {outline.seo && (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">SEO</p>
          {outline.seo.metaTitle && <p>metaTitle: {outline.seo.metaTitle}</p>}
          {outline.seo.metaDescription && <p>metaDescription: {outline.seo.metaDescription}</p>}
          {outline.seo.primaryKeyword && <p>primaryKeyword: {outline.seo.primaryKeyword}</p>}
          {outline.seo.secondaryKeywords && <p>secondaryKeywords: {outline.seo.secondaryKeywords.join(", ")}</p>}
        </div>
      )}
      {outline.sections?.length ? (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">Sections</p>
          <ul className="list-inside list-disc">{outline.sections.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      ) : null}
      {outline.faq?.length ? (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">FAQ</p>
          {outline.faq.map((f, i) => <p key={i}><strong>Q:</strong> {f.question} <strong>A:</strong> {f.answer}</p>)}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply outline</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
      <p className="mt-2 text-xs text-amber-700">After applying, review all fields — especially Product claims and SEO — before creating the article.</p>
    </div>
  );
}

function DraftPreview({
  draft,
  onApply,
  onDiscard,
}: {
  draft: AIDraftProposal;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">Draft proposal</p>
      {draft.titleSuggestion && <p className="text-sm"><strong>Title:</strong> {draft.titleSuggestion}</p>}
      {draft.summary && <p className="mt-1 text-xs text-[var(--ink)]"><strong>Summary:</strong> {draft.summary}</p>}
      {draft.seo && (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">SEO</p>
          {draft.seo.metaTitle && <p>metaTitle: {draft.seo.metaTitle}</p>}
          {draft.seo.metaDescription && <p>metaDescription: {draft.seo.metaDescription}</p>}
          {draft.seo.primaryKeyword && <p>primaryKeyword: {draft.seo.primaryKeyword}</p>}
          {draft.seo.secondaryKeywords && <p>secondaryKeywords: {draft.seo.secondaryKeywords.join(", ")}</p>}
        </div>
      )}
      {draft.productRefs?.length ? (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">Product framing</p>
          {draft.productRefs.map((r, i) => (
            <div key={i} className="mb-1 rounded border border-[var(--line)] bg-white p-2">
              <p><strong>{r.productId}</strong></p>
              {r.summary && <p>Summary: {r.summary}</p>}
              {r.verdict && <p>Verdict: {r.verdict}</p>}
              {r.bestFor && <p>Best for: {r.bestFor}</p>}
            </div>
          ))}
        </div>
      ) : null}
      {draft.faq?.length ? (
        <div className="mt-2 text-xs">
          <p className="font-medium text-[var(--muted)]">FAQ</p>
          {draft.faq.map((f, i) => <p key={i}><strong>Q:</strong> {f.question} <strong>A:</strong> {f.answer}</p>)}
        </div>
      ) : null}
      <div className="mt-2 text-xs">
        <p className="font-medium text-[var(--muted)]">Body preview</p>
        <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-[var(--line)] bg-white p-2 text-xs">{draft.bodyMarkdown}</pre>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply draft</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
      <p className="mt-2 text-xs text-amber-700">After applying, verify Product claims, review rankings/winner, review SEO, check affiliate disclosure, edit tone, then save as Draft.</p>
    </div>
  );
}
