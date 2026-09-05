"use client";

import { useState } from "react";
import { aiAssistArticleAction } from "@/lib/admin/actions";
import type {
  AIActionType,
  AIArticleContext,
  AIAssistResult,
  AIFaqItem,
  AIProductContext,
  AISeoSuggestion,
} from "@/lib/ai/types";
import type { ArticleV1 } from "@/types/article-v1";
import type { AdminProductOption } from "@/lib/admin/editor-constants";

type AIStatus = "idle" | "generating" | "ready" | "error";

export function AIAssistantPanel({
  draft,
  body,
  productOptions,
  isCreate,
  onApplySummary,
  onApplySeo,
  onApplyKeyTakeaways,
  onApplyFaq,
  onApplyBody,
}: {
  draft: ArticleV1;
  body: string;
  productOptions: AdminProductOption[];
  isCreate: boolean;
  onApplySummary: (text: string) => void;
  onApplySeo: (seo: AISeoSuggestion) => void;
  onApplyKeyTakeaways: (items: string[]) => void;
  onApplyFaq: (items: AIFaqItem[]) => void;
  onApplyBody: (text: string) => void;
}) {
  const [status, setStatus] = useState<AIStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAssistResult | null>(null);
  const [instruction, setInstruction] = useState("");

  if (isCreate) return null;

  function buildArticleContext(): AIArticleContext {
    return {
      title: draft.identity.title,
      type: draft.classification.type,
      category: draft.classification.category,
      intent: draft.editorial.intent,
      summary: draft.editorial.summary,
      body,
      currentSeo: draft.seo ? {
        metaTitle: draft.seo.metaTitle,
        metaDescription: draft.seo.metaDescription,
        primaryKeyword: draft.seo.primaryKeyword,
        secondaryKeywords: draft.seo.secondaryKeywords,
      } : undefined,
      currentFaq: draft.faq,
    };
  }

  function buildProductContext(): AIProductContext[] {
    const refs = draft.products?.primary ?? [];
    return refs
      .map((ref) => {
        const opt = productOptions.find((o) => o.id === ref.productId);
        if (!opt) return null;
        return {
          id: opt.id,
          name: opt.name,
          brand: opt.brand,
          category: opt.category ?? "",
          rating: opt.rating,
        } as AIProductContext;
      })
      .filter((p): p is AIProductContext => p !== null);
  }

  async function runAction(action: AIActionType) {
    if (status === "generating") return;
    setStatus("generating");
    setError(null);
    setResult(null);

    const res = await aiAssistArticleAction({
      action,
      articleContext: buildArticleContext(),
      productContext: buildProductContext(),
      instruction: instruction.trim() || undefined,
    });

    if (!res.ok) {
      setError(res.error);
      setStatus("error");
    } else {
      setResult(res);
      setStatus("ready");
    }
  }

  function handleDiscard() {
    setResult(null);
    setStatus("idle");
    setError(null);
  }

  const generating = status === "generating";

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">AI Assistant</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Suggestions are proposals only. Apply to modify local form, then Save normally.
        Content sent to the configured AI provider for processing.
      </p>

      <div className="mb-3">
        <label htmlFor="ai-instruction" className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Instruction (optional)
        </label>
        <textarea
          id="ai-instruction"
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          rows={2}
          placeholder="e.g. Make more concise, emphasize small-space use"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton label="Improve summary" disabled={generating} onClick={() => runAction("improve-summary")} />
        <ActionButton label="Suggest SEO" disabled={generating} onClick={() => runAction("suggest-seo")} />
        <ActionButton label="Key takeaways" disabled={generating} onClick={() => runAction("suggest-key-takeaways")} />
        <ActionButton label="Suggest FAQ" disabled={generating} onClick={() => runAction("suggest-faq")} />
        <ActionButton label="Improve body" disabled={generating} onClick={() => runAction("improve-body")} />
      </div>

      {generating && (
        <p className="text-sm text-[var(--muted)]">Generating…</p>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {result?.ok && result.action === "improve-summary" && (
        <SuggestionCard
          title="Suggested summary"
          current={draft.editorial.summary}
          suggested={result.suggestion.text}
          onApply={() => { onApplySummary(result.suggestion.text); handleDiscard(); }}
          onDiscard={handleDiscard}
        />
      )}

      {result?.ok && result.action === "suggest-seo" && (
        <SeoSuggestionCard
          current={draft.seo}
          suggestion={result.suggestion}
          onApply={() => { onApplySeo(result.suggestion); handleDiscard(); }}
          onDiscard={handleDiscard}
        />
      )}

      {result?.ok && result.action === "suggest-key-takeaways" && (
        <ListSuggestionCard
          title="Suggested key takeaways"
          items={result.suggestion}
          onApply={() => { onApplyKeyTakeaways(result.suggestion); handleDiscard(); }}
          onDiscard={handleDiscard}
        />
      )}

      {result?.ok && result.action === "suggest-faq" && (
        <FaqSuggestionCard
          items={result.suggestion}
          onApply={() => { onApplyFaq(result.suggestion); handleDiscard(); }}
          onDiscard={handleDiscard}
        />
      )}

      {result?.ok && result.action === "improve-body" && (
        <SuggestionCard
          title="Suggested body"
          current={body}
          suggested={result.suggestion.text}
          onApply={() => { onApplyBody(result.suggestion.text); handleDiscard(); }}
          onDiscard={handleDiscard}
          large
        />
      )}
    </div>
  );
}

function ActionButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-gray-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function SuggestionCard({
  title,
  current,
  suggested,
  onApply,
  onDiscard,
  large,
}: {
  title: string;
  current?: string;
  suggested: string;
  onApply: () => void;
  onDiscard: () => void;
  large?: boolean;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">{title}</p>
      {current && (
        <div className="mb-2">
          <p className="text-xs font-medium text-[var(--muted)]">Current:</p>
          <pre className={`whitespace-pre-wrap text-xs text-[var(--subtle)] ${large ? "max-h-40 overflow-y-auto" : ""}`}>{current}</pre>
        </div>
      )}
      <div className="mb-2">
        <p className="text-xs font-medium text-blue-800">Suggested:</p>
        <pre className={`whitespace-pre-wrap text-xs text-[var(--ink)] ${large ? "max-h-60 overflow-y-auto" : ""}`}>{suggested}</pre>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
    </div>
  );
}

function SeoSuggestionCard({
  current,
  suggestion,
  onApply,
  onDiscard,
}: {
  current?: { metaTitle?: string; metaDescription?: string; primaryKeyword?: string; secondaryKeywords?: string[] };
  suggestion: AISeoSuggestion;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">Suggested SEO</p>
      <table className="mb-2 w-full text-xs">
        <thead><tr><th className="text-left text-[var(--muted)]">Field</th><th className="text-left text-[var(--muted)]">Current</th><th className="text-left text-blue-800">Suggested</th></tr></thead>
        <tbody>
          {suggestion.metaTitle && <tr><td className="pr-2">metaTitle</td><td className="pr-2 text-[var(--subtle)]">{current?.metaTitle || "—"}</td><td>{suggestion.metaTitle}</td></tr>}
          {suggestion.metaDescription && <tr><td className="pr-2">metaDescription</td><td className="pr-2 text-[var(--subtle)]">{current?.metaDescription || "—"}</td><td>{suggestion.metaDescription}</td></tr>}
          {suggestion.primaryKeyword && <tr><td className="pr-2">primaryKeyword</td><td className="pr-2 text-[var(--subtle)]">{current?.primaryKeyword || "—"}</td><td>{suggestion.primaryKeyword}</td></tr>}
          {suggestion.secondaryKeywords && <tr><td className="pr-2">secondaryKeywords</td><td className="pr-2 text-[var(--subtle)]">{current?.secondaryKeywords?.join(", ") || "—"}</td><td>{suggestion.secondaryKeywords.join(", ")}</td></tr>}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply all</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
    </div>
  );
}

function ListSuggestionCard({
  title,
  items,
  onApply,
  onDiscard,
}: {
  title: string;
  items: string[];
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">{title}</p>
      <ul className="mb-2 list-inside list-disc text-xs text-[var(--ink)]">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
    </div>
  );
}

function FaqSuggestionCard({
  items,
  onApply,
  onDiscard,
}: {
  items: AIFaqItem[];
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-900">Suggested FAQ</p>
      {items.map((item, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs font-medium text-[var(--ink)]">Q: {item.question}</p>
          <p className="text-xs text-[var(--subtle)]">A: {item.answer}</p>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">Apply all</button>
        <button type="button" onClick={onDiscard} className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-gray-100">Discard</button>
      </div>
    </div>
  );
}
