/**
 * AI Suggestion service (Phase 40) — decision support only.
 *
 * create / list / accept / reject
 * acceptSuggestion → existing mutation boundaries (never direct Neon content writes).
 */
import { getAdminArticle, getAdminProduct } from "@/lib/admin";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { updateArticleMetadataFields } from "@/lib/article-mutations";
import { updateProductEditorialFields } from "@/lib/product-mutations";
import {
  deleteAISuggestionsForEntityForTests,
  findAISuggestionById,
  insertAISuggestion,
  listAISuggestionsByEntity,
  listAISuggestionsByStatus,
  updateAISuggestionStatus,
} from "@/lib/ai-suggestions-store";
import type {
  AISuggestionEntityType,
  AISuggestionQueueViewModel,
  AISuggestionRecord,
  AISuggestionStatus,
  AISuggestionTargetField,
  AISuggestionType,
  AISuggestionViewModel,
} from "@/types/ai-suggestion";
import type { ProductEditorialRoleV1 } from "@/types/product-v1";
import type { ArticleSearchIntent } from "@/types/article-v1";

export const APPLYABLE_TARGET_FIELDS: readonly AISuggestionTargetField[] = [
  "seo.metaTitle",
  "seo.metaDescription",
  "seo.primaryKeyword",
  "seo.secondaryKeywords",
  "editorial.summary",
  "editorial.audience",
  "editorial.intent",
  "editorial.role",
  "editorial.verdict",
  "editorial.bestFor",
  "editorial.notFor",
] as const;

export const ALL_TARGET_FIELDS: readonly AISuggestionTargetField[] = [
  ...APPLYABLE_TARGET_FIELDS,
  "content-gap.productCoverage",
  "internal-link.relatedArticle",
] as const;

export const SUGGESTION_TYPES: readonly AISuggestionType[] = [
  "seo",
  "content-gap",
  "internal-link",
  "editorial",
] as const;

const TARGET_FIELD_SET = new Set<string>(ALL_TARGET_FIELDS);
const TYPE_SET = new Set<string>(SUGGESTION_TYPES);
const APPLYABLE_SET = new Set<string>(APPLYABLE_TARGET_FIELDS);

export function isApplyableTargetField(
  field: string,
): field is AISuggestionTargetField {
  return APPLYABLE_SET.has(field);
}

export function isValidTargetField(field: unknown): field is AISuggestionTargetField {
  return typeof field === "string" && TARGET_FIELD_SET.has(field);
}

export function isValidSuggestionType(value: unknown): value is AISuggestionType {
  return typeof value === "string" && TYPE_SET.has(value);
}

export type CreateSuggestionInput = {
  entityType: AISuggestionEntityType;
  entityId: string;
  suggestionType: AISuggestionType;
  targetField: AISuggestionTargetField;
  currentValue?: string | null;
  proposedValue: string;
  reasoning: string;
  confidence?: number;
  createdBy: string;
};

export type SuggestionErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TARGET_FIELD"
  | "INVALID_SUGGESTION_TYPE"
  | "ENTITY_NOT_FOUND"
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "MUTATION_FAILED"
  | "STORE_UNAVAILABLE"
  | "VERSION_REQUIRED";

export type SuggestionSuccess = {
  success: true;
  suggestion: AISuggestionRecord;
  revisionId?: string | null;
};

export type SuggestionFailure = {
  success: false;
  error: SuggestionErrorCode;
  message: string;
};

export type SuggestionResult = SuggestionSuccess | SuggestionFailure;

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Pure validation of create payload (safe for unit tests without DB).
 */
export function validateCreateSuggestionInput(
  input: unknown,
):
  | { ok: true; input: CreateSuggestionInput }
  | { ok: false; error: SuggestionErrorCode; message: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "INVALID_INPUT", message: "input must be an object." };
  }
  const raw = input as Record<string, unknown>;

  if (raw.entityType !== "product" && raw.entityType !== "article") {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "entityType must be product or article.",
    };
  }
  if (typeof raw.entityId !== "string" || !raw.entityId.trim()) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "entityId is required.",
    };
  }
  if (!isValidSuggestionType(raw.suggestionType)) {
    return {
      ok: false,
      error: "INVALID_SUGGESTION_TYPE",
      message: `Unknown suggestionType: ${String(raw.suggestionType)}`,
    };
  }
  if (!isValidTargetField(raw.targetField)) {
    return {
      ok: false,
      error: "INVALID_TARGET_FIELD",
      message: `Target field not allowed: ${String(raw.targetField)}`,
    };
  }
  if (typeof raw.proposedValue !== "string" || !raw.proposedValue.trim()) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "proposedValue is required.",
    };
  }
  if (typeof raw.reasoning !== "string" || !raw.reasoning.trim()) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "reasoning is required.",
    };
  }
  if (typeof raw.createdBy !== "string" || !raw.createdBy.trim()) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "createdBy is required.",
    };
  }

  // Type/field consistency
  const field = raw.targetField;
  const type = raw.suggestionType;
  if (type === "seo" && !field.startsWith("seo.")) {
    return {
      ok: false,
      error: "INVALID_TARGET_FIELD",
      message: "seo suggestions require seo.* targetField.",
    };
  }
  if (type === "editorial" && !field.startsWith("editorial.")) {
    return {
      ok: false,
      error: "INVALID_TARGET_FIELD",
      message: "editorial suggestions require editorial.* targetField.",
    };
  }
  if (type === "content-gap" && field !== "content-gap.productCoverage") {
    return {
      ok: false,
      error: "INVALID_TARGET_FIELD",
      message: "content-gap requires content-gap.productCoverage.",
    };
  }
  if (type === "internal-link" && field !== "internal-link.relatedArticle") {
    return {
      ok: false,
      error: "INVALID_TARGET_FIELD",
      message: "internal-link requires internal-link.relatedArticle.",
    };
  }
  if (
    (field.startsWith("seo.") ||
      field === "editorial.summary" ||
      field === "editorial.audience" ||
      field === "editorial.intent") &&
    raw.entityType !== "article"
  ) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "Article fields require entityType article.",
    };
  }
  if (
    (field === "editorial.role" ||
      field === "editorial.verdict" ||
      field === "editorial.bestFor" ||
      field === "editorial.notFor") &&
    raw.entityType !== "product"
  ) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "Product editorial fields require entityType product.",
    };
  }

  return {
    ok: true,
    input: {
      entityType: raw.entityType,
      entityId: raw.entityId.trim(),
      suggestionType: type,
      targetField: field,
      currentValue:
        raw.currentValue === undefined || raw.currentValue === null
          ? null
          : String(raw.currentValue),
      proposedValue: raw.proposedValue.trim(),
      reasoning: raw.reasoning.trim(),
      confidence: clampConfidence(
        typeof raw.confidence === "number" ? raw.confidence : undefined,
      ),
      createdBy: raw.createdBy.trim(),
    },
  };
}

async function entityExists(
  entityType: AISuggestionEntityType,
  entityId: string,
): Promise<boolean> {
  if (entityType === "product") {
    return Boolean(await getAdminProduct(entityId));
  }
  return Boolean(await getAdminArticle(entityId));
}

export async function createSuggestion(
  input: unknown,
): Promise<SuggestionResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI suggestions require CONTENT_STORE=database.",
    };
  }

  const parsed = validateCreateSuggestionInput(input);
  if (!parsed.ok) {
    return { success: false, error: parsed.error, message: parsed.message };
  }

  if (!(await entityExists(parsed.input.entityType, parsed.input.entityId))) {
    return {
      success: false,
      error: "ENTITY_NOT_FOUND",
      message: `Entity not found: ${parsed.input.entityType}/${parsed.input.entityId}`,
    };
  }

  const suggestion = await insertAISuggestion({
    ...parsed.input,
    currentValue: parsed.input.currentValue ?? null,
    confidence: parsed.input.confidence ?? 50,
  });

  return { success: true, suggestion };
}

async function resolveEntityName(
  entityType: AISuggestionEntityType,
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
  record: AISuggestionRecord,
  entityName: string,
): AISuggestionViewModel {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    entityName,
    suggestionType: record.suggestionType,
    targetField: record.targetField,
    currentValue: record.currentValue,
    proposedValue: record.proposedValue,
    reasoning: record.reasoning,
    confidence: record.confidence,
    status: record.status,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
    mutationRevisionId: record.mutationRevisionId,
    applyable: isApplyableTargetField(record.targetField),
  };
}

export async function getSuggestionsForEntity(
  entityType: AISuggestionEntityType,
  entityId: string,
): Promise<AISuggestionViewModel[]> {
  if (!isDatabaseContentStore()) return [];
  const rows = await listAISuggestionsByEntity(entityType, entityId);
  const name = await resolveEntityName(entityType, entityId);
  return rows.map((r) => toViewModel(r, name));
}

export async function getPendingSuggestions(
  limit = 40,
): Promise<AISuggestionQueueViewModel> {
  if (!isDatabaseContentStore()) {
    return { pendingCount: 0, items: [] };
  }
  const rows = await listAISuggestionsByStatus("pending", limit);
  const items: AISuggestionViewModel[] = [];
  for (const row of rows) {
    const name = await resolveEntityName(row.entityType, row.entityId);
    items.push(toViewModel(row, name));
  }
  return { pendingCount: items.length, items };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build Phase 34/35 mutation changes from a suggestion.
 * Returns null for advisory-only targets (content-gap / internal-link).
 */
export function buildMutationChangesFromSuggestion(
  suggestion: AISuggestionRecord,
): unknown | null {
  const field = suggestion.targetField;
  const value = suggestion.proposedValue;

  if (field === "seo.metaTitle") {
    return { seo: { metaTitle: value } };
  }
  if (field === "seo.metaDescription") {
    return { seo: { metaDescription: value } };
  }
  if (field === "seo.primaryKeyword") {
    return { seo: { primaryKeyword: value } };
  }
  if (field === "seo.secondaryKeywords") {
    return { seo: { secondaryKeywords: parseStringArray(value) } };
  }
  if (field === "editorial.summary") {
    return { editorial: { summary: value } };
  }
  if (field === "editorial.audience") {
    return { editorial: { audience: parseStringArray(value) } };
  }
  if (field === "editorial.intent") {
    return { editorial: { intent: value as ArticleSearchIntent } };
  }
  if (field === "editorial.role") {
    return { editorial: { role: value as ProductEditorialRoleV1 } };
  }
  if (field === "editorial.verdict") {
    return { editorial: { verdict: value } };
  }
  if (field === "editorial.bestFor") {
    return { editorial: { bestFor: parseStringArray(value) } };
  }
  if (field === "editorial.notFor") {
    return { editorial: { notFor: parseStringArray(value) } };
  }
  return null;
}

/**
 * Accept suggestion:
 * - Applyable fields → existing mutation boundary → revision → mark accepted
 * - Advisory fields (content-gap / internal-link) → mark accepted (decision audit only, no content write)
 */
export async function acceptSuggestion(input: {
  suggestionId: string;
  actor: string;
  expectedVersion?: number;
}): Promise<SuggestionResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI suggestions require CONTENT_STORE=database.",
    };
  }
  if (!input.actor?.trim()) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "actor is required.",
    };
  }

  const existing = await findAISuggestionById(input.suggestionId);
  if (!existing) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Suggestion not found: ${input.suggestionId}`,
    };
  }
  if (existing.status !== "pending") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Suggestion is ${existing.status}, not pending.`,
    };
  }

  const changes = buildMutationChangesFromSuggestion(existing);

  // Advisory-only: acknowledge without writing canonical content.
  if (!changes) {
    const updated = await updateAISuggestionStatus({
      id: existing.id,
      status: "accepted",
      reviewedBy: input.actor,
      mutationRevisionId: null,
    });
    return {
      success: true,
      suggestion: updated!,
      revisionId: null,
    };
  }

  let revisionId: string | null = null;

  if (existing.entityType === "article") {
    const record = await getAdminArticle(existing.entityId);
    if (!record) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Article not found: ${existing.entityId}`,
      };
    }
    const version = input.expectedVersion ?? record.version;
    if (version === undefined) {
      return {
        success: false,
        error: "VERSION_REQUIRED",
        message: "expectedVersion required for article accept.",
      };
    }
    const result = await updateArticleMetadataFields({
      articleId: existing.entityId,
      changes,
      expectedVersion: version,
      actor: input.actor,
    });
    if (!result.success) {
      return {
        success: false,
        error: "MUTATION_FAILED",
        message: `${result.error}: ${result.message}`,
      };
    }
    revisionId = result.revisionId;
  } else {
    const record = await getAdminProduct(existing.entityId);
    if (!record) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Product not found: ${existing.entityId}`,
      };
    }
    const version = input.expectedVersion ?? record.version;
    if (version === undefined) {
      return {
        success: false,
        error: "VERSION_REQUIRED",
        message: "expectedVersion required for product accept.",
      };
    }
    const result = await updateProductEditorialFields({
      productId: existing.entityId,
      changes,
      expectedVersion: version,
      actor: input.actor,
    });
    if (!result.success) {
      return {
        success: false,
        error: "MUTATION_FAILED",
        message: `${result.error}: ${result.message}`,
      };
    }
    revisionId = result.revisionId;
  }

  const updated = await updateAISuggestionStatus({
    id: existing.id,
    status: "accepted",
    reviewedBy: input.actor,
    mutationRevisionId: revisionId,
  });

  return {
    success: true,
    suggestion: updated!,
    revisionId,
  };
}

/**
 * Reject suggestion — preserves history (status → rejected). Never deletes.
 */
export async function rejectSuggestion(input: {
  suggestionId: string;
  actor: string;
}): Promise<SuggestionResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI suggestions require CONTENT_STORE=database.",
    };
  }
  if (!input.actor?.trim()) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "actor is required.",
    };
  }

  const existing = await findAISuggestionById(input.suggestionId);
  if (!existing) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Suggestion not found: ${input.suggestionId}`,
    };
  }
  if (existing.status !== "pending") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Suggestion is ${existing.status}, not pending.`,
    };
  }

  const updated = await updateAISuggestionStatus({
    id: existing.id,
    status: "rejected",
    reviewedBy: input.actor,
    mutationRevisionId: null,
  });

  return { success: true, suggestion: updated! };
}

export async function expireSuggestion(input: {
  suggestionId: string;
  actor: string;
}): Promise<SuggestionResult> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "STORE_UNAVAILABLE",
      message: "AI suggestions require CONTENT_STORE=database.",
    };
  }
  const existing = await findAISuggestionById(input.suggestionId);
  if (!existing) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: `Suggestion not found: ${input.suggestionId}`,
    };
  }
  if (existing.status !== "pending") {
    return {
      success: false,
      error: "NOT_PENDING",
      message: `Suggestion is ${existing.status}, not pending.`,
    };
  }
  const updated = await updateAISuggestionStatus({
    id: existing.id,
    status: "expired",
    reviewedBy: input.actor,
  });
  return { success: true, suggestion: updated! };
}

export { deleteAISuggestionsForEntityForTests };

export type { AISuggestionRecord, AISuggestionViewModel, AISuggestionStatus };
