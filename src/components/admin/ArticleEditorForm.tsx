"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createAdminArticleAction,
  loadAdminArticleAction,
  saveAdminArticleAction,
} from "@/lib/admin/actions";
import { blankArticleV1 } from "@/lib/admin/blank-article";
import {
  ARTICLE_INTENTS,
  ARTICLE_RATING_SCALE,
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
  type AdminProductOption,
} from "@/lib/admin/editor-constants";
import { suggestArticleSlug } from "@/lib/admin/article-id";
import { normalizeArticleV1 } from "@/lib/admin/normalize-article";
import { ArticleBodyEditor } from "@/components/admin/ArticleBodyEditor";
import { articleBodyChangeLine } from "@/lib/admin/article-body";
import {
  articleChangeSummary,
  highRiskArticleChanges,
} from "@/lib/admin/change-summary";
import { articleLocalHints } from "@/lib/admin/local-hints";
import type { AdminSaveResult, AdminWriteMode } from "@/lib/admin/types";
import type {
  ArticleComparisonRowV1,
  ArticleProductReferenceV1,
  ArticleSearchIntent,
  ArticleV1,
  ArticleV1Type,
} from "@/types/article-v1";
import { AdminSection } from "@/components/admin/AdminSection";
import {
  CanonicalJsonPreview,
  ChangeSummary,
  CreateSummary,
  EditorToolbar,
  ValidationSummary,
} from "@/components/admin/EditorChrome";
import { StatusBadge } from "@/components/admin/AdminBadges";
import {
  CheckboxField,
  NumberField,
  RepeatableStrings,
  SelectField,
  TextAreaField,
  TextField,
  ReadOnlyField,
} from "@/components/admin/EditorFields";
import { UnsavedChangesGuard } from "@/components/admin/UnsavedChangesGuard";
import { saveRefreshStatusDetail } from "@/lib/admin/save-feedback";
import { AIAssistantPanel } from "@/components/admin/AIAssistantPanel";
import { AIDraftAssistantPanel } from "@/components/admin/AIDraftAssistantPanel";
import { PublishReadinessPanel } from "@/components/admin/PublishReadinessPanel";
import { RefreshContextPanel } from "@/components/admin/RefreshContextPanel";
import { ProductMaintenanceArticleContextPanel } from "@/components/admin/ProductMaintenanceArticleContextPanel";
import type { RefreshCandidate } from "@/lib/editorial/content-refresh";
import type { ProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";
import type { AIFaqItem, AISeoSuggestion } from "@/lib/ai/types";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function snapshot(article: ArticleV1): string {
  return JSON.stringify(normalizeArticleV1(article));
}

function productLabel(options: AdminProductOption[], id: string): string {
  const match = options.find((option) => option.id === id);
  return match ? `${match.name} (${id})` : id;
}

function createRisks(article: ArticleV1): string[] {
  const risks: string[] = [];
  if (article.publishing?.featured) risks.push("Article is Featured");
  if (article.classification?.type) {
    risks.push(`Type ${article.classification.type} becomes immutable after create`);
  }
  return risks;
}

function confirmPublishingTransition(loaded: ArticleV1, draft: ArticleV1): boolean {
  const wasPublished = loaded.publishing.status === "published";
  const willPublish = draft.publishing.status === "published";

  if (!wasPublished && willPublish) {
    return window.confirm(
      "Publish this article?\n\nIt will become publicly accessible after validation and cache refresh.",
    );
  }

  if (wasPublished && draft.publishing.status !== "published") {
    return window.confirm(
      `Change status from published to ${draft.publishing.status}?\n\nThis will remove the article from public publishing.`,
    );
  }

  return true;
}

export function ArticleEditorForm({
  article,
  body: initialBody = "",
  productOptions,
  writeMode,
  version,
  sourceFile,
  mode = "edit",
  existingArticleIds = [],
  existingArticleSlugs = [],
  justCreated = false,
  createEnabled = true,
  createDisabledReason,
  revisionCount = 0,
  refreshCandidate,
  productMaintenanceContext,
  productMaintenanceProductId,
  productMaintenanceProductName,
}: {
  article: ArticleV1;
  body?: string;
  productOptions: AdminProductOption[];
  writeMode: AdminWriteMode;
  version?: number;
  sourceFile: string;
  mode?: "edit" | "create";
  existingArticleIds?: string[];
  existingArticleSlugs?: string[];
  justCreated?: boolean;
  createEnabled?: boolean;
  createDisabledReason?: string;
  revisionCount?: number;
  refreshCandidate?: RefreshCandidate;
  productMaintenanceContext?: ProductMaterialChangeContext;
  productMaintenanceProductId?: string;
  productMaintenanceProductName?: string;
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [draft, setDraft] = useState(article);
  const [loaded, setLoaded] = useState(article);
  const [body, setBody] = useState(initialBody);
  const [loadedBody, setLoadedBody] = useState(initialBody);
  const [baseline, setBaseline] = useState(() => snapshot(article));
  const [bodyBaseline, setBodyBaseline] = useState(initialBody);
  const [recordVersion, setRecordVersion] = useState(version);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [result, setResult] = useState<AdminSaveResult | null>(
    justCreated ? { ok: true, errors: [], warnings: [] } : null,
  );
  const [savedAt, setSavedAt] = useState<string | undefined>(justCreated ? "just now" : undefined);
  const [idTouched, setIdTouched] = useState(Boolean(article.identity.id));
  const [slugTouched, setSlugTouched] = useState(Boolean(article.identity.slug));

  const metadataDirty = useMemo(() => snapshot(draft) !== baseline, [draft, baseline]);
  const bodyDirty = !isCreate && body !== bodyBaseline;
  const dirty = metadataDirty || bodyDirty;
  const writeEnabled = isCreate
    ? writeMode === "database" && createEnabled
    : writeMode === "database" || writeMode === "development";
  const type = draft.classification.type;
  const primary = draft.products?.primary ?? [];
  const suggestedSlug = suggestArticleSlug(draft.identity.title);
  const normalizedDraft = useMemo(() => normalizeArticleV1(draft), [draft]);
  const normalizedLoaded = useMemo(() => normalizeArticleV1(loaded), [loaded]);
  const changeLines = useMemo(() => {
    if (isCreate) return [];
    const lines = articleChangeSummary(
      normalizedLoaded as unknown as Record<string, unknown>,
      normalizedDraft as unknown as Record<string, unknown>,
    );
    const bodyLine = articleBodyChangeLine(loadedBody, body);
    if (bodyLine) lines.push(bodyLine);
    return lines;
  }, [isCreate, normalizedDraft, normalizedLoaded, loadedBody, body]);
  const highRisk = useMemo(
    () =>
      isCreate
        ? createRisks(normalizedDraft)
        : highRiskArticleChanges(
            normalizedLoaded as unknown as Record<string, unknown>,
            normalizedDraft as unknown as Record<string, unknown>,
          ),
    [isCreate, normalizedDraft, normalizedLoaded],
  );
  const localHints = useMemo(
    () =>
      articleLocalHints(normalizedDraft, {
        mode: isCreate ? "create" : "edit",
        existingIds: existingArticleIds,
        existingSlugs: existingArticleSlugs,
        body: isCreate ? undefined : body,
      }),
    [isCreate, normalizedDraft, existingArticleIds, existingArticleSlugs, body],
  );
  const stale = Boolean(result?.errors.some((error) => error.includes("changed after you opened")));
  const statusDetail = useMemo(() => saveRefreshStatusDetail(result, status), [result, status]);
  const previewHref =
    !isCreate && draft.publishing.status === "published"
      ? `/blog/${draft.identity.slug}`
      : undefined;

  function update(patch: (current: ArticleV1) => ArticleV1) {
    setDraft((current) => patch(current));
    if (status === "saved") setStatus("idle");
  }

  function updateBody(next: string) {
    setBody(next);
    if (status === "saved") setStatus("idle");
  }

  async function onSave() {
    if (status === "saving") return;
    if (!isCreate && !dirty) return;
    if (localHints.errors.length > 0) {
      setResult({ ok: false, errors: localHints.errors, warnings: localHints.warnings });
      setStatus("failed");
      document.getElementById("admin-validation-summary")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!isCreate && !confirmPublishingTransition(loaded, draft)) return;
    if (!isCreate && highRisk.length > 0) {
      const confirmed = window.confirm(
        `High-risk changes:\n${highRisk.join("\n")}\n\nSave anyway?`,
      );
      if (!confirmed) return;
    }
    if (isCreate && draft.publishing.featured) {
      const confirmed = window.confirm(
        "High-risk create:\nArticle is Featured\n\nCreate anyway as draft?",
      );
      if (!confirmed) return;
    }
    setStatus("saving");
    const canonical = normalizeArticleV1({
      ...draft,
      publishing: {
        ...draft.publishing,
        status: isCreate ? "draft" : draft.publishing.status,
      },
    });
    const saveResult = isCreate
      ? await createAdminArticleAction(canonical, body || undefined)
      : await saveAdminArticleAction(canonical, recordVersion, body);
    setResult(saveResult);
    if (saveResult.ok) {
      setDraft(canonical);
      setLoaded(canonical);
      setBaseline(snapshot(canonical));
      if (!isCreate) {
        setLoadedBody(body);
        setBodyBaseline(body);
      }
      if (saveResult.version !== undefined) setRecordVersion(saveResult.version);
      setSavedAt("just now");
      setStatus("saved");
      if (isCreate) {
        router.push(`/admin/articles/${canonical.identity.id}?created=1`);
      }
    } else {
      setStatus("failed");
      document.getElementById("admin-validation-summary")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function onReset() {
    if (!dirty) return;
    const message = isCreate
      ? "Discard this candidate and reset to a blank Article?"
      : "Discard unsaved changes and restore the last loaded record?";
    if (!window.confirm(message)) return;
    const next = isCreate ? blankArticleV1() : loaded;
    setDraft(next);
    if (!isCreate) {
      setBody(loadedBody);
    }
    setResult(null);
    setStatus("idle");
    if (isCreate) {
      setIdTouched(false);
      setSlugTouched(false);
    }
  }

  async function onReload() {
    if (isCreate) return;
    if (dirty && !window.confirm("Reload latest will discard unsaved changes. Continue?")) return;
    const latest = await loadAdminArticleAction(article.identity.id);
    if ("error" in latest) {
      setResult({ ok: false, errors: [latest.error], warnings: [] });
      setStatus("failed");
      return;
    }
    const nextBody = latest.body ?? "";
    setDraft(latest.article);
    setLoaded(latest.article);
    setBaseline(snapshot(latest.article));
    setBody(nextBody);
    setLoadedBody(nextBody);
    setBodyBaseline(nextBody);
    setRecordVersion(latest.version);
    setResult(null);
    setStatus("idle");
  }

  function updatePrimary(next: ArticleProductReferenceV1[]) {
    update((current) => ({
      ...current,
      products: { ...current.products, primary: next },
    }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <UnsavedChangesGuard dirty={dirty} />
      <EditorToolbar
        title={
          isCreate
            ? draft.identity.title || "New Article"
            : draft.identity.title || article.identity.title
        }
        subtitle={
          isCreate
            ? draft.identity.slug
              ? `/blog/${draft.identity.slug} (draft)`
              : "Choose ID, slug, and type before creating"
            : `/blog/${draft.identity.slug}${recordVersion ? ` · v${recordVersion}` : ""}`
        }
        dirty={dirty}
        status={status}
        savedAt={savedAt}
        writeMode={writeMode}
        writeEnabled={writeEnabled}
        variant={isCreate ? "create" : "save"}
        createLabel="Create Article"
        previewHref={previewHref}
        historyHref={isCreate ? undefined : `/admin/articles/${draft.identity.id}/history`}
        historyCount={isCreate ? undefined : revisionCount}
        badge={<StatusBadge status={isCreate ? "draft" : draft.publishing.status} />}
        stale={stale}
        statusDetail={statusDetail}
        onSave={() => void onSave()}
        onReset={onReset}
        onReload={() => void onReload()}
        onCopyJson={() => {
          void navigator.clipboard.writeText(JSON.stringify(normalizedDraft, null, 2));
        }}
      />
      {isCreate && !createEnabled ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {createDisabledReason ?? "Article creation is disabled on this environment."}
        </div>
      ) : null}
      <div id="admin-validation-summary">
        <ValidationSummary
          result={result}
          localErrors={localHints.errors}
          localWarnings={localHints.warnings}
          stale={stale}
          onReload={() => void onReload()}
          onCopyJson={() => {
            void navigator.clipboard.writeText(JSON.stringify(normalizedDraft, null, 2));
          }}
        />
      </div>
      {isCreate ? (
        <CreateSummary
          title="Article to create"
          fields={[
            { label: "id", value: draft.identity.id },
            { label: "title", value: draft.identity.title },
            { label: "slug", value: draft.identity.slug },
            { label: "type", value: draft.classification.type },
            { label: "status", value: "draft" },
          ]}
          risks={highRisk}
        />
      ) : (
        <ChangeSummary lines={changeLines} highRisk={highRisk} />
      )}

      {refreshCandidate && !isCreate && (
        <RefreshContextPanel candidate={refreshCandidate} />
      )}

      {productMaintenanceContext && productMaintenanceProductId && productMaintenanceProductName && !isCreate && (
        <ProductMaintenanceArticleContextPanel
          productId={productMaintenanceProductId}
          productName={productMaintenanceProductName}
          context={productMaintenanceContext}
        />
      )}

      {isCreate && (
        <div className="mb-6">
          <AdminSection title="AI Draft Assistant" description="Optional — generate an outline or full draft from AI. Manual creation works without AI.">
            <AIDraftAssistantPanel
              productOptions={productOptions}
              onApplyDraft={(patch) => {
                const hasMeaningfulEdits = dirty;
                if (hasMeaningfulEdits && !window.confirm("Applying this draft will replace fields in the current unsaved form. Continue?")) return;
                update((current) => {
                  const next = { ...current };
                  if (patch.title) {
                    const slug = suggestArticleSlug(patch.title);
                    next.identity = { ...next.identity, title: patch.title, id: idTouched ? next.identity.id : slug, slug: slugTouched ? next.identity.slug : slug };
                  }
                  if (patch.summary) next.editorial = { ...next.editorial, summary: patch.summary };
                  if (patch.seo) {
                    next.seo = {
                      ...next.seo,
                      ...(patch.seo.metaTitle !== undefined ? { metaTitle: patch.seo.metaTitle } : {}),
                      ...(patch.seo.metaDescription !== undefined ? { metaDescription: patch.seo.metaDescription } : {}),
                      ...(patch.seo.primaryKeyword !== undefined ? { primaryKeyword: patch.seo.primaryKeyword } : {}),
                      ...(patch.seo.secondaryKeywords !== undefined ? { secondaryKeywords: patch.seo.secondaryKeywords } : {}),
                    };
                  }
                  if (patch.faq) next.faq = patch.faq;
                  if (patch.productRefs) {
                    const existing = next.products?.primary ?? [];
                    const merged = existing.map((ref) => {
                      const aiRef = patch.productRefs?.find((r) => r.productId === ref.productId);
                      if (!aiRef) return ref;
                      return {
                        ...ref,
                        summary: aiRef.summary ?? ref.summary,
                        verdict: aiRef.verdict ?? ref.verdict,
                        bestFor: aiRef.bestFor ?? ref.bestFor,
                      };
                    });
                    next.products = { ...next.products, primary: merged };
                  }
                  return next;
                });
                if (patch.body) updateBody(patch.body);
              }}
            />
          </AdminSection>
        </div>
      )}

      <div className="space-y-6">
        {isCreate ? (
          <p className="text-sm text-[var(--muted)]">
            New articles are always created as <strong>draft</strong> with an empty Markdown body.
            Publish and edit prose later from the Article editor. Neon stores the durable body; the
            repository pointer at <code className="text-xs">content/posts/{"{slug}"}.md</code> is
            initialized for compatibility only.
          </p>
        ) : draft.publishing.status === "published" ? (
          <p className="text-sm">
            Public page:{" "}
            <Link href={`/blog/${draft.identity.slug}`} className="font-medium underline-offset-2 hover:underline">
              /blog/{draft.identity.slug}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Unpublished articles are not linked on the public site until status is published.
          </p>
        )}

        <AdminSection
          title="Identity"
          description={
            isCreate
              ? "ID and slug become immutable after create. Type is also permanent under current policy."
              : "ID and slug are read-only. URL rename/redirect is not part of this phase."
          }
        >
          {isCreate ? (
            <TextField
              id="article-id"
              label="id"
              value={draft.identity.id}
              hint={
                suggestedSlug && suggestedSlug !== draft.identity.id
                  ? `Suggested ID: ${suggestedSlug}`
                  : "Lowercase slug-like permanent ID."
              }
              onChange={(id) => {
                setIdTouched(true);
                update((current) => ({
                  ...current,
                  identity: { ...current.identity, id },
                }));
              }}
            />
          ) : (
            <ReadOnlyField label="id" value={draft.identity.id} hint="Read-only permanent ID" />
          )}
          <TextField
            id="article-title"
            label="title"
            value={draft.identity.title}
            onChange={(title) =>
              update((current) => {
                const suggestion = suggestArticleSlug(title);
                return {
                  ...current,
                  identity: {
                    ...current.identity,
                    title,
                    id: !idTouched ? suggestion : current.identity.id,
                    slug: !slugTouched ? suggestion : current.identity.slug,
                  },
                };
              })
            }
          />
          {isCreate ? (
            <TextField
              id="article-slug"
              label="slug"
              value={draft.identity.slug}
              hint={
                suggestedSlug && suggestedSlug !== draft.identity.slug
                  ? `Suggested slug: ${suggestedSlug}`
                  : "Public URL segment. Becomes read-only after create."
              }
              onChange={(slug) => {
                setSlugTouched(true);
                update((current) => ({
                  ...current,
                  identity: { ...current.identity, slug },
                }));
              }}
            />
          ) : (
            <ReadOnlyField
              label="slug"
              value={draft.identity.slug}
              hint="Public URL segment — read-only in Phase 13C"
            />
          )}
        </AdminSection>

        <AdminSection title="Classification">
          {isCreate ? (
            <SelectField
              id="article-type"
              label="type"
              allowEmpty
              emptyLabel="Select article type"
              value={draft.classification.type}
              options={ARTICLE_TYPES.map((value) => ({ value, label: value }))}
              hint="Article type cannot currently be changed after creation."
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  classification: {
                    ...current.classification,
                    type: value as ArticleV1Type,
                  },
                }))
              }
            />
          ) : (
            <ReadOnlyField
              label="type"
              value={draft.classification.type}
              hint="Type is read-only here so template-specific fields are not silently invalidated."
            />
          )}
          <TextField
            id="article-category"
            label="category"
            value={draft.classification.category ?? ""}
            onChange={(category) =>
              update((current) => ({
                ...current,
                classification: { ...current.classification, category },
              }))
            }
          />
          <TextField
            id="article-subcategory"
            label="subcategory"
            value={draft.classification.subcategory ?? ""}
            onChange={(subcategory) =>
              update((current) => ({
                ...current,
                classification: { ...current.classification, subcategory },
              }))
            }
          />
          <RepeatableStrings
            id="article-tags"
            label="tags"
            addLabel="Add tag"
            values={draft.classification.tags ?? []}
            onChange={(tags) =>
              update((current) => ({
                ...current,
                classification: { ...current.classification, tags },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Editorial">
          <TextAreaField
            id="article-summary"
            label="summary"
            value={draft.editorial.summary ?? ""}
            onChange={(summary) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, summary },
              }))
            }
          />
          <SelectField
            id="article-intent"
            label="intent"
            allowEmpty={isCreate}
            emptyLabel="Select search intent"
            value={draft.editorial.intent}
            options={ARTICLE_INTENTS.map((value) => ({ value, label: value }))}
            onChange={(intent) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, intent: intent as ArticleSearchIntent },
              }))
            }
          />
          <TextAreaField
            id="article-methodology"
            label="methodology"
            value={draft.editorial.methodology ?? ""}
            onChange={(methodology) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, methodology },
              }))
            }
          />
          <RepeatableStrings
            id="article-audience"
            label="audience"
            values={draft.editorial.audience ?? []}
            onChange={(audience) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, audience },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="SEO" description="primaryKeyword and secondaryKeywords are stored as data only.">
          <TextField
            id="seo-title"
            label="metaTitle"
            value={draft.seo?.metaTitle ?? ""}
            onChange={(metaTitle) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, metaTitle },
              }))
            }
            hint={`${(draft.seo?.metaTitle ?? "").length} characters (hint only)`}
          />
          <TextAreaField
            id="seo-description"
            label="metaDescription"
            value={draft.seo?.metaDescription ?? ""}
            onChange={(metaDescription) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, metaDescription },
              }))
            }
            hint={`${(draft.seo?.metaDescription ?? "").length} characters (hint only)`}
          />
          <TextField
            id="seo-primary"
            label="primaryKeyword"
            value={draft.seo?.primaryKeyword ?? ""}
            onChange={(primaryKeyword) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, primaryKeyword },
              }))
            }
          />
          <RepeatableStrings
            id="seo-secondary"
            label="secondaryKeywords"
            values={draft.seo?.secondaryKeywords ?? []}
            onChange={(secondaryKeywords) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, secondaryKeywords },
              }))
            }
          />
          <TextField
            id="seo-canonical"
            label="canonical"
            value={draft.seo?.canonical ?? ""}
            onChange={(canonical) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, canonical },
              }))
            }
          />
          <CheckboxField
            id="seo-noindex"
            label="noindex"
            checked={Boolean(draft.seo?.noindex)}
            onChange={(noindex) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, noindex },
              }))
            }
          />
        </AdminSection>

        <AdminSection
          title="Products"
          description="These fields are article-specific overrides. They do not edit Product V1 catalog data."
        >
          {primary.map((ref, index) => {
            const selected = productOptions.find((option) => option.id === ref.productId);
            return (
            <div key={`${ref.productId}-${index}`} className="mb-4 rounded-md border border-[var(--line)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Reference {index + 1}
              </p>
              {selected ? (
                <p className="mb-3 text-sm text-[var(--muted)]">
                  {selected.name} · {selected.brand}
                  {selected.category ? ` · ${selected.category}` : ""}
                  {typeof selected.rating === "number" ? ` · rating ${selected.rating}` : ""}
                  <span className="block text-xs text-[var(--subtle)]">
                    Display-only catalog context. Not saved on Article V1.
                  </span>
                </p>
              ) : null}
              <SelectField
                id={`ref-product-${index}`}
                label="productId"
                value={ref.productId}
                options={productOptions.map((option) => ({
                  value: option.id,
                  label: `${option.name} (${option.id})`,
                }))}
                onChange={(productId) => {
                  const next = [...primary];
                  next[index] = { ...ref, productId };
                  update((current) => ({
                    ...current,
                    products: { ...current.products, primary: next },
                    comparison:
                      current.comparison?.winnerId === ref.productId && productId !== ref.productId
                        ? { ...current.comparison, winnerId: undefined }
                        : current.comparison,
                  }));
                }}
              />
              {type === "best-list" || type === "comparison" ? (
                <NumberField
                  id={`ref-rank-${index}`}
                  label="rank"
                  value={ref.rank}
                  hint={type === "best-list" ? "Ranks must be unique. The editor will not auto-reorder products." : undefined}
                  onChange={(rank) => {
                    const next = [...primary];
                    next[index] = { ...ref, rank };
                    updatePrimary(next);
                  }}
                />
              ) : null}
              <TextField
                id={`ref-role-${index}`}
                label="role"
                value={ref.role ?? ""}
                hint="Article-specific badge/role"
                onChange={(role) => {
                  const next = [...primary];
                  next[index] = { ...ref, role };
                  updatePrimary(next);
                }}
              />
              <TextAreaField
                id={`ref-summary-${index}`}
                label="summary"
                value={ref.summary ?? ""}
                hint="Article-specific blurb, not the product catalog verdict"
                onChange={(summary) => {
                  const next = [...primary];
                  next[index] = { ...ref, summary };
                  updatePrimary(next);
                }}
              />
              <TextAreaField
                id={`ref-verdict-${index}`}
                label="verdict override"
                value={ref.verdict ?? ""}
                hint="Article-specific verdict override"
                onChange={(verdict) => {
                  const next = [...primary];
                  next[index] = { ...ref, verdict };
                  updatePrimary(next);
                }}
              />
              <TextField
                id={`ref-bestFor-${index}`}
                label="bestFor override"
                value={ref.bestFor ?? ""}
                hint="Article-specific bestFor override"
                onChange={(bestFor) => {
                  const next = [...primary];
                  next[index] = { ...ref, bestFor };
                  updatePrimary(next);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const removed = primary[index];
                  const next = primary.filter((_, itemIndex) => itemIndex !== index);
                  update((current) => ({
                    ...current,
                    products: { ...current.products, primary: next },
                    comparison:
                      current.comparison?.winnerId === removed.productId
                        ? { ...current.comparison, winnerId: undefined }
                        : current.comparison,
                  }));
                }}
                className="mt-2 text-sm text-[var(--danger)]"
              >
                Remove product reference
              </button>
            </div>
            );
          })}
          <SelectField
            id="add-product-ref"
            label="Add product"
            allowEmpty
            emptyLabel="Select a product to add"
            value=""
            options={productOptions
              .filter((option) => !primary.some((ref) => ref.productId === option.id))
              .map((option) => ({
                value: option.id,
                label: `${option.name} (${option.id})`,
              }))}
            onChange={(productId) => {
              if (!productId) return;
              updatePrimary([...primary, { productId }]);
            }}
          />
        </AdminSection>

        {!isCreate && (
          <AdminSection title="AI Assistant" description="AI suggestions modify local form only. Save is still required.">
            <AIAssistantPanel
              draft={draft}
              body={body}
              productOptions={productOptions}
              isCreate={isCreate}
              onApplySummary={(text: string) =>
                update((current) => ({
                  ...current,
                  editorial: { ...current.editorial, summary: text },
                }))
              }
              onApplySeo={(seo: AISeoSuggestion) =>
                update((current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    ...(seo.metaTitle !== undefined ? { metaTitle: seo.metaTitle } : {}),
                    ...(seo.metaDescription !== undefined ? { metaDescription: seo.metaDescription } : {}),
                    ...(seo.primaryKeyword !== undefined ? { primaryKeyword: seo.primaryKeyword } : {}),
                    ...(seo.secondaryKeywords !== undefined ? { secondaryKeywords: seo.secondaryKeywords } : {}),
                  },
                }))
              }
              onApplyKeyTakeaways={() => {
                // ArticleV1 does not have a top-level keyTakeaways field;
                // key takeaways are editorial content for the body. No-op placeholder.
              }}
              onApplyFaq={(items: AIFaqItem[]) =>
                update((current) => ({
                  ...current,
                  faq: [...(current.faq ?? []), ...items],
                }))
              }
              onApplyBody={(text: string) => updateBody(text)}
            />
          </AdminSection>
        )}

        <AdminSection
          title="Article Body"
          description={
            isCreate
              ? "Body starts empty after create. Edit Markdown on the Article detail page."
              : writeMode === "database"
                ? `Durable Markdown is stored in Neon articles.body. Saving does not rewrite repository Markdown (seed/reference: ${sourceFile.replace(/\.json$/, ".md")}).`
                : "Development filesystem mode writes the Markdown body under content/posts."
          }
        >
          {isCreate && !body ? (
            <ReadOnlyField
              label="Initial body"
              value="(empty — use AI Draft Assistant above or edit after create)"
              hint={
                draft.identity.slug
                  ? `Pointer seed: content/posts/${draft.identity.slug}.md`
                  : "Set slug to determine the Markdown pointer path."
              }
            />
          ) : isCreate && body ? (
            <ArticleBodyEditor
              id="article-body-markdown"
              value={body}
              onChange={updateBody}
              disabled={!writeEnabled}
            />
          ) : (
            <ArticleBodyEditor
              id="article-body-markdown"
              value={body}
              onChange={updateBody}
              disabled={!writeEnabled}
            />
          )}
        </AdminSection>

        {(type === "review" || (draft.review?.ratingCategories?.length ?? 0) > 0) && (
          <AdminSection
            title="Review"
            description={`Article-specific rating categories (scale ${ARTICLE_RATING_SCALE.min}–${ARTICLE_RATING_SCALE.max}). Overall product rating remains Product-owned.`}
          >
            {(draft.review?.ratingCategories ?? []).map((category, index) => (
              <div key={`rating-${index}`} className="mb-3 rounded-md border border-[var(--line)] p-3">
                <TextField
                  id={`rating-label-${index}`}
                  label="label"
                  value={category.label}
                  onChange={(label) => {
                    const next = [...(draft.review?.ratingCategories ?? [])];
                    next[index] = { ...category, label };
                    update((current) => ({
                      ...current,
                      review: { ratingCategories: next },
                    }));
                  }}
                />
                <NumberField
                  id={`rating-score-${index}`}
                  label="score"
                  min={ARTICLE_RATING_SCALE.min}
                  max={ARTICLE_RATING_SCALE.max}
                  step={ARTICLE_RATING_SCALE.step}
                  value={category.score}
                  onChange={(score) => {
                    const next = [...(draft.review?.ratingCategories ?? [])];
                    next[index] = { ...category, score: score ?? 0 };
                    update((current) => ({
                      ...current,
                      review: { ratingCategories: next },
                    }));
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      review: {
                        ratingCategories: (current.review?.ratingCategories ?? []).filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      },
                    }))
                  }
                  className="text-sm text-[var(--danger)]"
                >
                  Remove category
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                update((current) => ({
                  ...current,
                  review: {
                    ratingCategories: [
                      ...(current.review?.ratingCategories ?? []),
                      { label: "", score: 0 },
                    ],
                  },
                }))
              }
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)]"
            >
              Add rating category
            </button>
          </AdminSection>
        )}

        {(type === "comparison" || draft.comparison) && (
          <AdminSection title="Comparison">
            <SelectField
              id="comparison-winner"
              label="winnerId"
              allowEmpty
              emptyLabel="Select a winner from compared products"
              value={draft.comparison?.winnerId ?? ""}
              options={primary.map((ref) => ({
                value: ref.productId,
                label: productLabel(productOptions, ref.productId),
              }))}
              onChange={(winnerId) =>
                update((current) => ({
                  ...current,
                  comparison: { ...current.comparison, winnerId: winnerId || undefined },
                }))
              }
            />
            <TextAreaField
              id="comparison-reason"
              label="winnerReason"
              value={draft.comparison?.winnerReason ?? ""}
              onChange={(winnerReason) =>
                update((current) => ({
                  ...current,
                  comparison: { ...current.comparison, winnerReason },
                }))
              }
            />
            {(draft.comparison?.rows ?? []).map((row, index) => (
              <ComparisonRowEditor
                key={`row-${index}`}
                row={row}
                index={index}
                productIds={primary.map((ref) => ref.productId)}
                productOptions={productOptions}
                onChange={(nextRow) => {
                  const rows = [...(draft.comparison?.rows ?? [])];
                  rows[index] = nextRow;
                  update((current) => ({
                    ...current,
                    comparison: { ...current.comparison, rows },
                  }));
                }}
                onRemove={() =>
                  update((current) => ({
                    ...current,
                    comparison: {
                      ...current.comparison,
                      rows: (current.comparison?.rows ?? []).filter((_, itemIndex) => itemIndex !== index),
                    },
                  }))
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                update((current) => ({
                  ...current,
                  comparison: {
                    ...current.comparison,
                    rows: [
                      ...(current.comparison?.rows ?? []),
                      { label: "", source: "editorial", values: {} },
                    ],
                  },
                }))
              }
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)]"
            >
              Add comparison row
            </button>
          </AdminSection>
        )}

        <AdminSection title="FAQ">
          {(draft.faq ?? []).map((item, index) => (
            <div key={`faq-${index}`} className="mb-3 rounded-md border border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                FAQ {index + 1}
              </p>
              <TextField
                id={`faq-q-${index}`}
                label="question"
                value={item.question}
                onChange={(question) => {
                  const faq = [...(draft.faq ?? [])];
                  faq[index] = { ...item, question };
                  update((current) => ({ ...current, faq }));
                }}
              />
              <TextAreaField
                id={`faq-a-${index}`}
                label="answer"
                value={item.answer}
                onChange={(answer) => {
                  const faq = [...(draft.faq ?? [])];
                  faq[index] = { ...item, answer };
                  update((current) => ({ ...current, faq }));
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    const faq = [...(draft.faq ?? [])];
                    [faq[index - 1], faq[index]] = [faq[index], faq[index - 1]];
                    update((current) => ({ ...current, faq }));
                  }}
                  className="text-sm ring-1 ring-[var(--line)] rounded-md px-2 py-1 disabled:opacity-40"
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={index === (draft.faq?.length ?? 1) - 1}
                  onClick={() => {
                    const faq = [...(draft.faq ?? [])];
                    [faq[index + 1], faq[index]] = [faq[index], faq[index + 1]];
                    update((current) => ({ ...current, faq }));
                  }}
                  className="text-sm ring-1 ring-[var(--line)] rounded-md px-2 py-1 disabled:opacity-40"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      faq: (current.faq ?? []).filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  className="text-sm text-[var(--danger)]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update((current) => ({
                ...current,
                faq: [...(current.faq ?? []), { question: "", answer: "" }],
              }))
            }
            className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)]"
          >
            Add FAQ
          </button>
        </AdminSection>

        <AdminSection title="Commerce" description="Article commerce cannot override Product Amazon URLs.">
          <CheckboxField
            id="article-affiliate"
            label="affiliateEnabled"
            checked={Boolean(draft.commerce?.affiliateEnabled)}
            onChange={(affiliateEnabled) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, affiliateEnabled },
              }))
            }
          />
          <CheckboxField
            id="article-disclosure"
            label="disclosure"
            checked={Boolean(draft.commerce?.disclosure)}
            onChange={(disclosure) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, disclosure },
              }))
            }
          />
          <TextField
            id="article-cta"
            label="ctaStyle"
            value={draft.commerce?.ctaStyle ?? ""}
            onChange={(ctaStyle) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, ctaStyle },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Media">
          <TextField
            id="article-featured-image"
            label="featuredImage"
            value={draft.media?.featuredImage ?? ""}
            onChange={(featuredImage) =>
              update((current) => ({
                ...current,
                media: { ...current.media, featuredImage },
              }))
            }
          />
          <TextField
            id="article-og"
            label="ogImage"
            value={draft.media?.ogImage ?? ""}
            onChange={(ogImage) =>
              update((current) => ({
                ...current,
                media: { ...current.media, ogImage },
              }))
            }
          />
          <TextField
            id="article-pinterest"
            label="pinterestImage"
            value={draft.media?.pinterestImage ?? ""}
            onChange={(pinterestImage) =>
              update((current) => ({
                ...current,
                media: { ...current.media, pinterestImage },
              }))
            }
          />
        </AdminSection>

        <AdminSection
          title="Publishing"
          description={
            isCreate
              ? "Create always stores status=draft. Publish later from the editor after reviewing content."
              : "Publishing as published runs full Article validation, including product references."
          }
        >
          {isCreate ? (
            <ReadOnlyField
              label="status"
              value="draft"
              hint="Create & Publish is not available in this phase."
            />
          ) : (
            <SelectField
              id="article-status"
              label="status"
              value={draft.publishing.status}
              options={ARTICLE_STATUSES.map((value) => ({ value, label: value }))}
              onChange={(statusValue) =>
                update((current) => ({
                  ...current,
                  publishing: {
                    ...current.publishing,
                    status: statusValue as ArticleV1["publishing"]["status"],
                  },
                }))
              }
            />
          )}
          {!isCreate && draft.publishing.status === "scheduled" && (
            <div className="mb-4">
              <label htmlFor="article-scheduledAt" className="mb-1 block text-sm font-medium text-[var(--ink)]">
                Scheduled publish time
              </label>
              <input
                id="article-scheduledAt"
                type="datetime-local"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
                value={
                  draft.publishing.scheduledAt
                    ? toLocalDatetimeValue(draft.publishing.scheduledAt)
                    : ""
                }
                onChange={(e) => {
                  const local = e.target.value;
                  const utc = local ? new Date(local).toISOString() : undefined;
                  update((current) => ({
                    ...current,
                    publishing: { ...current.publishing, scheduledAt: utc },
                  }));
                }}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Stored as UTC.{" "}
                Your local time: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
              {draft.publishing.scheduledAt && (
                <p className="mt-1 text-xs text-[var(--subtle)]">
                  UTC: {draft.publishing.scheduledAt}
                </p>
              )}
            </div>
          )}
          <TextField
            id="article-publishedAt"
            label="publishedAt"
            value={draft.publishing.publishedAt ?? ""}
            hint="Leave empty for drafts. Do not invent a publication date."
            onChange={(publishedAt) =>
              update((current) => ({
                ...current,
                publishing: { ...current.publishing, publishedAt },
              }))
            }
          />
          <TextField
            id="article-updatedAt"
            label="updatedAt"
            value={draft.publishing.updatedAt ?? ""}
            hint="Not auto-rewritten on save."
            onChange={(updatedAt) =>
              update((current) => ({
                ...current,
                publishing: { ...current.publishing, updatedAt },
              }))
            }
          />
          <TextField
            id="article-author"
            label="author"
            value={draft.publishing.author ?? ""}
            onChange={(author) =>
              update((current) => ({
                ...current,
                publishing: { ...current.publishing, author },
              }))
            }
          />
          <CheckboxField
            id="article-featured"
            label="featured"
            checked={Boolean(draft.publishing.featured)}
            onChange={(featured) =>
              update((current) => ({
                ...current,
                publishing: { ...current.publishing, featured },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Relationships / Related Links">
          <TextField
            id="rel-parent"
            label="parentTopic"
            value={draft.relationships?.parentTopic ?? ""}
            onChange={(parentTopic) =>
              update((current) => ({
                ...current,
                relationships: { ...current.relationships, parentTopic },
              }))
            }
          />
          {(draft.relationships?.relatedLinks ?? []).map((link, index) => (
            <div key={`link-${index}`} className="mb-3 rounded-md border border-[var(--line)] p-3">
              <TextField
                id={`link-title-${index}`}
                label="title"
                value={link.title}
                onChange={(title) => {
                  const relatedLinks = [...(draft.relationships?.relatedLinks ?? [])];
                  relatedLinks[index] = { ...link, title };
                  update((current) => ({
                    ...current,
                    relationships: { ...current.relationships, relatedLinks },
                  }));
                }}
              />
              <TextField
                id={`link-href-${index}`}
                label="href"
                value={link.href}
                onChange={(href) => {
                  const relatedLinks = [...(draft.relationships?.relatedLinks ?? [])];
                  relatedLinks[index] = { ...link, href };
                  update((current) => ({
                    ...current,
                    relationships: { ...current.relationships, relatedLinks },
                  }));
                }}
              />
              <button
                type="button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    relationships: {
                      ...current.relationships,
                      relatedLinks: (current.relationships?.relatedLinks ?? []).filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    },
                  }))
                }
                className="text-sm text-[var(--danger)]"
              >
                Remove link
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update((current) => ({
                ...current,
                relationships: {
                  ...current.relationships,
                  relatedLinks: [
                    ...(current.relationships?.relatedLinks ?? []),
                    { title: "", href: "" },
                  ],
                },
              }))
            }
            className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)]"
          >
            Add related link
          </button>
        </AdminSection>
      </div>
      {!isCreate && (
        <div className="mt-6">
          <PublishReadinessPanel draft={draft} body={body} />
        </div>
      )}
      <CanonicalJsonPreview value={normalizedDraft} />
    </form>
  );
}

function ComparisonRowEditor({
  row,
  index,
  productIds,
  productOptions,
  onChange,
  onRemove,
}: {
  row: ArticleComparisonRowV1;
  index: number;
  productIds: string[];
  productOptions: AdminProductOption[];
  onChange: (row: ArticleComparisonRowV1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mb-3 rounded-md border border-[var(--line)] p-3">
      <TextField
        id={`row-label-${index}`}
        label="label"
        value={row.label}
        onChange={(label) => onChange({ ...row, label })}
      />
      <SelectField
        id={`row-source-${index}`}
        label="source"
        value={row.source}
        options={[
          { value: "editorial", label: "editorial" },
          { value: "spec", label: "spec" },
        ]}
        onChange={(source) => {
          if (source === "spec") {
            onChange({
              label: row.label,
              source: "spec",
              specPath: row.source === "spec" ? row.specPath : "",
              values: row.values,
            });
            return;
          }
          onChange({
            label: row.label,
            source: "editorial",
            values: row.values ?? {},
          });
        }}
      />
      {row.source === "spec" ? (
        <>
          <TextField
            id={`row-spec-${index}`}
            label="specPath"
            value={row.specPath}
            onChange={(specPath) => onChange({ ...row, specPath })}
          />
          <p className="mb-3 text-xs text-amber-800">
            Spec-derived runtime resolution is not yet active.
          </p>
        </>
      ) : null}
      {productIds.map((productId) => (
        <TextField
          key={productId}
          id={`row-${index}-${productId}`}
          label={productLabel(productOptions, productId)}
          value={row.values?.[productId] ?? ""}
          onChange={(value) =>
            onChange({
              ...row,
              values: { ...(row.values ?? {}), [productId]: value },
            } as ArticleComparisonRowV1)
          }
        />
      ))}
      <button type="button" onClick={onRemove} className="text-sm text-[var(--danger)]">
        Remove row
      </button>
    </div>
  );
}
