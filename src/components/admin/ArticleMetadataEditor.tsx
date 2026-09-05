"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateArticleMetadataFieldsAction } from "@/lib/admin/actions";
import { ARTICLE_INTENTS } from "@/lib/admin/editor-constants";
import { AdminSection } from "@/components/admin/AdminSection";
import {
  RepeatableStrings,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/EditorFields";
import type { ArticleSearchIntent, ArticleV1 } from "@/types/article-v1";
import type { AdminWriteMode } from "@/lib/admin/types";

type ArticleMetadataEditorProps = {
  article: ArticleV1;
  version?: number;
  writeMode: AdminWriteMode;
};

/**
 * Minimal Phase 35 metadata editor — editorial + SEO only.
 * No Markdown, products, relationships, or publishing controls.
 */
export function ArticleMetadataEditor({
  article,
  version,
  writeMode,
}: ArticleMetadataEditorProps) {
  const router = useRouter();
  const [summary, setSummary] = useState(article.editorial.summary ?? "");
  const [audience, setAudience] = useState<string[]>(article.editorial.audience ?? []);
  const [intent, setIntent] = useState(article.editorial.intent);
  const [metaTitle, setMetaTitle] = useState(article.seo?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(
    article.seo?.metaDescription ?? "",
  );
  const [primaryKeyword, setPrimaryKeyword] = useState(
    article.seo?.primaryKeyword ?? "",
  );
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(
    article.seo?.secondaryKeywords ?? [],
  );
  const [recordVersion, setRecordVersion] = useState(version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const writeBlocked = writeMode === "disabled";

  async function onSave() {
    if (recordVersion === undefined) {
      setError("Missing record version. Reload before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const changes = {
      editorial: {
        summary,
        audience,
        intent: intent as ArticleSearchIntent,
      },
      seo: {
        metaTitle,
        metaDescription,
        primaryKeyword,
        secondaryKeywords,
      },
    };

    const result = await updateArticleMetadataFieldsAction(
      article.identity.id,
      changes,
      recordVersion,
    );

    setSaving(false);

    if (!result.success) {
      setError(`${result.error}: ${result.message}`);
      return;
    }

    setRecordVersion(result.version);
    setSuccess(
      result.revisionCreated
        ? `Saved. Revision ${result.revisionId ?? "created"}.`
        : "Saved (no content change).",
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/articles/${article.identity.id}`}
          className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          ← Full article record
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--ink)]">
          Metadata edit
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Controlled mutation path for{" "}
          <span className="font-medium text-[var(--ink)]">{article.identity.title}</span>
          . Editorial and SEO fields only — Markdown is not editable here.
        </p>
        <p className="mt-1 text-xs text-[var(--subtle)]">
          Article ID: {article.identity.id} · Slug: {article.identity.slug}
          {recordVersion !== undefined ? ` · Version: ${recordVersion}` : ""}
        </p>
      </div>

      <div className="rounded-md border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--muted)]">
        Identity (title/slug), Markdown body, product references, relationships, and
        publishing status are not editable on this path.
      </div>

      <AdminSection
        title="Editorial"
        description="summary, audience, intent — Phase 35 allowlist."
      >
        <TextAreaField
          id="meta-summary"
          label="summary"
          value={summary}
          onChange={setSummary}
        />
        <RepeatableStrings
          id="meta-audience"
          label="audience"
          values={audience}
          onChange={setAudience}
        />
        <SelectField
          id="meta-intent"
          label="intent"
          value={intent}
          options={ARTICLE_INTENTS.map((value) => ({ value, label: value }))}
          onChange={(value) => setIntent(value as ArticleSearchIntent)}
        />
      </AdminSection>

      <AdminSection
        title="SEO"
        description="metaTitle, metaDescription, primaryKeyword, secondaryKeywords."
      >
        <TextField
          id="meta-metaTitle"
          label="metaTitle"
          value={metaTitle}
          onChange={setMetaTitle}
        />
        <TextAreaField
          id="meta-metaDescription"
          label="metaDescription"
          value={metaDescription}
          onChange={setMetaDescription}
          rows={3}
        />
        <TextField
          id="meta-primaryKeyword"
          label="primaryKeyword"
          value={primaryKeyword}
          onChange={setPrimaryKeyword}
        />
        <RepeatableStrings
          id="meta-secondaryKeywords"
          label="secondaryKeywords"
          values={secondaryKeywords}
          onChange={setSecondaryKeywords}
        />
      </AdminSection>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving || writeBlocked || recordVersion === undefined}
          onClick={() => void onSave()}
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save metadata"}
        </button>
        <Link
          href={`/admin/articles/${article.identity.id}/history`}
          className="rounded-md px-4 py-2 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]"
        >
          Revision history
        </Link>
      </div>
    </div>
  );
}
