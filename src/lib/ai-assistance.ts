/**
 * AI Assistance service (Phase 43).
 *
 * Deterministic drafts from SmartDesk context.
 * Accept creates an AI suggestion or editorial task.
 * Never writes ProductV1 / ArticleV1 / Markdown.
 */
import { getAdminArticle, getAdminProduct } from "@/lib/admin";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  buildInternalLinkSuggestions,
} from "@/lib/content-graph";
import { listArticlesV1 } from "@/lib/content/articles";
import {
  buildArticleAIContext,
  buildProductAIContext,
  serializeAIPromptContext,
} from "@/lib/ai-context";
import { createSuggestion } from "@/lib/ai-suggestions";
import { createEditorialTask } from "@/lib/editorial-tasks";
import {
  deleteAIAssistanceForEntityForTests,
  findAIAssistanceById,
  insertAIAssistance,
  listAIAssistanceByEntity,
  listAllAIAssistance,
  updateAIAssistanceReview,
} from "@/lib/ai-assistance-store";
import type { AIContextViewModel } from "@/types/ai-context";
import type {
  AIAssistanceDraftPayload,
  AIAssistanceEntityType,
  AIAssistanceQueueViewModel,
  AIAssistanceRecord,
  AIAssistanceStatus,
  AIAssistanceType,
  AIAssistanceViewModel,
} from "@/types/ai-assistance";

export type AssistanceErrorCode =
  | "INVALID_INPUT"
  | "INVALID_STATUS"
  | "ENTITY_NOT_FOUND"
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "STORE_UNAVAILABLE"
  | "GOVERNANCE_FAILED";

export type AssistanceSuccess = {
  success: true;
  assistance: AIAssistanceViewModel;
};

export type AssistanceFailure = {
  success: false;
  error: AssistanceErrorCode;
  message: string;
};

export type AssistanceResult = AssistanceSuccess | AssistanceFailure;

export const ASSISTANCE_TYPES: readonly AIAssistanceType[] = [
  "seo",
  "content-improvement",
  "product-editorial",
  "internal-link",
] as const;

function isAssistanceType(value: unknown): value is AIAssistanceType {
  return (
    value === "seo" ||
    value === "content-improvement" ||
    value === "product-editorial" ||
    value === "internal-link"
  );
}

export function parseAssistanceDraft(
  output: string,
): AIAssistanceDraftPayload | null {
  try {
    const parsed = JSON.parse(output) as AIAssistanceDraftPayload;
    if (!parsed || typeof parsed.title !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pure draft builder — no I/O, no writes.
 */
export function draftAssistanceFromContext(
  context: AIContextViewModel,
  type: AIAssistanceType,
): AIAssistanceDraftPayload {
  const { entity } = context;
  const name = entity.name;

  if (type === "seo") {
    if (entity.entityType !== "article") {
      return {
        title: `SEO listing copy for ${name}`,
        body: "Product SEO is tracked via supporting articles. Create a coverage task rather than writing catalog fields.",
        suggestionType: null,
        targetField: null,
        proposedValue: null,
        currentValue: null,
      };
    }
    if (!entity.seo.metaTitle || entity.seo.metaTitle.length < 20) {
      const proposed = entity.seo.primaryKeyword
        ? `${name} | ${entity.seo.primaryKeyword}`
        : `${name} — small-space office guide`;
      return {
        title: "Suggested meta title",
        body: `Current title is thin or missing. Proposed: ${proposed}`,
        suggestionType: "seo",
        targetField: "seo.metaTitle",
        proposedValue: proposed.slice(0, 60),
        currentValue: entity.seo.metaTitle,
      };
    }
    const proposedDesc =
      entity.editorial.summary?.slice(0, 150) ||
      `Practical ${entity.seo.primaryKeyword ?? "small-space"} guidance for ${name}.`;
    return {
      title: "Suggested meta description",
      body: `Improve the search snippet for ${name}.`,
      suggestionType: "seo",
      targetField: "seo.metaDescription",
      proposedValue: proposedDesc,
      currentValue: entity.seo.metaDescription,
    };
  }

  if (type === "product-editorial") {
    if (entity.entityType !== "product") {
      return {
        title: `Editorial summary for ${name}`,
        body: entity.editorial.summary
          ? `Tighten the article summary while keeping the ${entity.editorial.intentOrRole ?? "editorial"} intent.`
          : "Add a one-sentence summary of who this article is for.",
        suggestionType: "editorial",
        targetField: "editorial.summary",
        proposedValue:
          entity.editorial.summary ??
          `${name} helps small-space readers choose a practical setup.`,
        currentValue: entity.editorial.summary,
      };
    }
    if (!entity.editorial.verdict) {
      return {
        title: "Draft verdict",
        body: `Write a concise verdict for ${name} based on small-space fit.`,
        suggestionType: "editorial",
        targetField: "editorial.verdict",
        proposedValue: `${name} is a strong small-space pick when footprint and adjustability matter more than extras.`,
        currentValue: null,
      };
    }
    const proposedBestFor =
      entity.editorial.bestFor.length > 0
        ? JSON.stringify([...entity.editorial.bestFor, "compact apartments"])
        : JSON.stringify(["compact apartments", "budget small-space setups"]);
    return {
      title: "Clarify best-for",
      body: `Sharpen who ${name} is for without changing catalog identity.`,
      suggestionType: "editorial",
      targetField: "editorial.bestFor",
      proposedValue: proposedBestFor,
      currentValue: JSON.stringify(entity.editorial.bestFor),
    };
  }

  if (type === "internal-link") {
    const first = context.relatedArticles[0];
    if (!first) {
      return {
        title: "Internal linking gap",
        body: `${name} has no related article connections yet. Review topic cluster coverage.`,
        suggestionType: "internal-link",
        targetField: "internal-link.relatedArticle",
        proposedValue: null,
        currentValue: null,
      };
    }
    return {
      title: `Link to ${first.name}`,
      body: `Add a related-article connection from ${name} to ${first.name} (${first.id}).`,
      suggestionType: "internal-link",
      targetField: "internal-link.relatedArticle",
      proposedValue: first.id,
      currentValue: null,
    };
  }

  const gaps = context.intelligenceSignals;
  return {
    title: `Content improvement for ${name}`,
    body:
      gaps.length > 0
        ? `Signals: ${gaps.join(", ")}. Address coverage or clarity without auto-publishing.`
        : `${name} looks complete. Review for clarity and internal links.`,
    suggestionType: "content-gap",
    targetField: "content-gap.productCoverage",
    proposedValue:
      context.relatedProducts[0]?.id ??
      context.relatedArticles[0]?.id ??
      "Review coverage gaps in workspace.",
    currentValue: null,
  };
}

async function enrichInternalLinkContext(
  context: AIContextViewModel,
): Promise<AIContextViewModel> {
  if (context.entityType !== "article") return context;
  const articles = await listArticlesV1();
  const source = articles.find((a) => a.identity.id === context.entityId);
  if (!source) return context;
  const links = buildInternalLinkSuggestions(source, articles);
  const extras = links.suggestedArticles.slice(0, 5).map((item) => ({
    id: item.articleId,
    name: item.title,
    kind: "article" as const,
  }));
  const seen = new Set(context.relatedArticles.map((r) => r.id));
  const merged = [...context.relatedArticles];
  for (const extra of extras) {
    if (!seen.has(extra.id)) merged.push(extra);
  }
  return { ...context, relatedArticles: merged };
}

async function resolveEntityName(
  entityType: AIAssistanceEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === "product") {
    const record = await getAdminProduct(entityId);
    return record?.product.identity.name ?? entityId;
  }
  const record = await getAdminArticle(entityId);
  return record?.article.identity.title ?? entityId;
}

function toViewModel(
  record: AIAssistanceRecord,
  entityName: string,
): AIAssistanceViewModel {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    entityName,
    type: record.type,
    promptContext: record.inputContext,
    output: record.output,
    draft: parseAssistanceDraft(record.output),
    status: record.status,
    suggestionId: record.suggestionId,
    taskId: record.taskId,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
  };
}

async function recordToViewModel(
  record: AIAssistanceRecord,
): Promise<AIAssistanceViewModel> {
  return toViewModel(
    record,
    await resolveEntityName(record.entityType, record.entityId),
  );
}

export async function generateAssistance(input: {
  entityType: AIAssistanceEntityType;
  entityId: string;
  type: AIAssistanceType;
  createdBy: string;
}): Promise<AssistanceResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI assistance requires CONTENT_STORE=database.",
    };
  }
  if (!isAssistanceType(input.type) || !input.createdBy.trim()) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "type and createdBy are required.",
    };
  }

  const context =
    input.entityType === "article"
      ? await buildArticleAIContext(input.entityId)
      : await buildProductAIContext(input.entityId);
  if (!context) {
    return {
      success: false,
      error: "ENTITY_NOT_FOUND",
      message: `Entity not found: ${input.entityType}/${input.entityId}`,
    };
  }

  const enriched =
    input.type === "internal-link"
      ? await enrichInternalLinkContext(context)
      : context;
  const draft = draftAssistanceFromContext(enriched, input.type);
  const inputContext = serializeAIPromptContext(enriched);
  const {
    buildDefaultGenerationMetadata,
    contextFingerprint,
  } = await import("@/lib/ai-evaluation");
  const contextHash = contextFingerprint(inputContext);
  const generationMetadata = JSON.stringify(
    buildDefaultGenerationMetadata(contextHash),
  );
  const record = await insertAIAssistance({
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    inputContext,
    output: JSON.stringify(draft),
    createdBy: input.createdBy.trim(),
    generationMetadata,
  });

  return { success: true, assistance: await recordToViewModel(record) };
}

export async function getAssistanceForEntity(
  entityType: AIAssistanceEntityType,
  entityId: string,
): Promise<AIAssistanceViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listAIAssistanceByEntity(entityType, entityId);
  return Promise.all(rows.map((r) => recordToViewModel(r)));
}

export async function getAssistanceQueue(
  limit = 80,
): Promise<AIAssistanceQueueViewModel> {
  if (!isDatabaseContentStore()) {
    return {
      draftCount: 0,
      reviewedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      items: [],
      pendingReview: [],
    };
  }
  const rows = await listAllAIAssistance(limit);
  const items = await Promise.all(rows.map((r) => recordToViewModel(r)));
  const draft = items.filter((i) => i.status === "draft");
  const reviewed = items.filter((i) => i.status === "reviewed");
  const accepted = items.filter((i) => i.status === "accepted");
  const rejected = items.filter((i) => i.status === "rejected");
  return {
    draftCount: draft.length,
    reviewedCount: reviewed.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    items,
    pendingReview: [...draft, ...reviewed],
  };
}

export async function markAssistanceReviewed(
  id: string,
  actor: string,
): Promise<AssistanceResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI assistance requires CONTENT_STORE=database.",
    };
  }
  const existing = await findAIAssistanceById(id);
  if (!existing) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  if (existing.status !== "draft") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Cannot mark reviewed from ${existing.status}.`,
    };
  }
  const updated = await updateAIAssistanceReview({
    id,
    status: "reviewed",
    reviewedBy: actor,
    suggestionId: existing.suggestionId,
    taskId: existing.taskId,
  });
  if (!updated) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  return { success: true, assistance: await recordToViewModel(updated) };
}

async function acceptViaGovernance(
  record: AIAssistanceRecord,
  actor: string,
): Promise<
  | { ok: true; suggestionId: string | null; taskId: string | null }
  | { ok: false; message: string }
> {
  const draft = parseAssistanceDraft(record.output);
  if (!draft) {
    return { ok: false, message: "Assistance output is not structured." };
  }

  if (draft.suggestionType && draft.targetField && draft.proposedValue) {
    const suggestion = await createSuggestion({
      entityType: record.entityType,
      entityId: record.entityId,
      suggestionType: draft.suggestionType,
      targetField: draft.targetField,
      currentValue: draft.currentValue,
      proposedValue: draft.proposedValue,
      reasoning: `${draft.title}: ${draft.body}`,
      confidence: 70,
      createdBy: actor,
    });
    if (!suggestion.success) {
      return { ok: false, message: suggestion.message };
    }
    return { ok: true, suggestionId: suggestion.suggestion.id, taskId: null };
  }

  const task = await createEditorialTask({
    entityType: record.entityType,
    entityId: record.entityId,
    sourceType: "ai-assistance",
    sourceId: record.id,
    title: draft.title,
    description: `${draft.body}\n\nSource assistance: ${record.id}`,
    priority: "medium",
    createdBy: actor,
  });
  if (!task.success) {
    return { ok: false, message: task.message };
  }
  return { ok: true, suggestionId: null, taskId: task.task.id };
}

export async function acceptAssistance(
  id: string,
  actor: string,
): Promise<AssistanceResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI assistance requires CONTENT_STORE=database.",
    };
  }
  const existing = await findAIAssistanceById(id);
  if (!existing) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  if (existing.status !== "draft" && existing.status !== "reviewed") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Cannot accept assistance in status ${existing.status}.`,
    };
  }

  const routed = await acceptViaGovernance(existing, actor);
  if (!routed.ok) {
    return {
      success: false,
      error: "GOVERNANCE_FAILED",
      message: routed.message,
    };
  }

  const updated = await updateAIAssistanceReview({
    id,
    status: "accepted",
    reviewedBy: actor,
    suggestionId: routed.suggestionId,
    taskId: routed.taskId,
  });
  if (!updated) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  return { success: true, assistance: await recordToViewModel(updated) };
}

export async function rejectAssistance(
  id: string,
  actor: string,
): Promise<AssistanceResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI assistance requires CONTENT_STORE=database.",
    };
  }
  const existing = await findAIAssistanceById(id);
  if (!existing) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  if (existing.status !== "draft" && existing.status !== "reviewed") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Cannot reject assistance in status ${existing.status}.`,
    };
  }
  const updated = await updateAIAssistanceReview({
    id,
    status: "rejected",
    reviewedBy: actor,
    suggestionId: existing.suggestionId,
    taskId: existing.taskId,
  });
  if (!updated) {
    return { success: false, error: "NOT_FOUND", message: `Not found: ${id}` };
  }
  return { success: true, assistance: await recordToViewModel(updated) };
}

export { deleteAIAssistanceForEntityForTests };

export type { AIAssistanceViewModel, AIAssistanceStatus, AIAssistanceType };
