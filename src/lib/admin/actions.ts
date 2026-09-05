"use server";

import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import {
  updateProductEditorialFields,
  type ProductMutationResult,
} from "@/lib/product-mutations";
import {
  updateArticleMetadataFields,
  type ArticleMutationResult,
} from "@/lib/article-mutations";
import {
  approveChange,
  createWorkflowRecord,
  getWorkflowStatus,
  publishChange,
  reopenForEdit,
  submitForReview,
  type WorkflowResult,
} from "@/lib/editorial-workflow";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";
import { requireAdmin } from "./require-admin";
import { getAdminArticle, createAdminArticle, saveAdminArticle } from "./article-store";
import { createAdminProduct, getAdminProduct, saveAdminProduct } from "./product-store";
import {
  getArticleRevisionCount,
  getArticleRevisionDetail,
  getProductRevisionCount,
  getProductRevisionDetail,
  listArticleRevisionItems,
  listProductRevisionItems,
  restoreArticleRevision,
  restoreProductRevision,
} from "./revision-store";
import type { AdminArticleRecord, AdminProductRecord, AdminSaveResult } from "./types";

function expired(): AdminSaveResult {
  return {
    ok: false,
    errors: ["Your admin session has expired. Sign in again before saving."],
    warnings: [],
  };
}

function databaseFailed(): AdminSaveResult {
  return {
    ok: false,
    errors: ["Database save failed."],
    warnings: [],
  };
}

export async function saveAdminProductAction(
  product: ProductV1Document,
  expectedVersion?: number,
): Promise<AdminSaveResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return expired();
  }
  try {
    return await saveAdminProduct(product, { expectedVersion, actor });
  } catch {
    return databaseFailed();
  }
}

/**
 * Phase 34 — controlled editorial-only product mutation.
 * Does not accept full ProductV1Document writes.
 */
export async function updateProductEditorialFieldsAction(
  productId: string,
  changes: unknown,
  expectedVersion: number,
): Promise<ProductMutationResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "Your admin session has expired. Sign in again before saving.",
    };
  }
  try {
    return await updateProductEditorialFields({
      productId,
      changes,
      expectedVersion,
      actor,
    });
  } catch {
    return {
      success: false,
      error: "SAVE_FAILED",
      message: "Database save failed.",
    };
  }
}

/**
 * Phase 35 — controlled article metadata mutation.
 * Does not accept Markdown body, products, relationships, or publishing.
 */
export async function updateArticleMetadataFieldsAction(
  articleId: string,
  changes: unknown,
  expectedVersion: number,
): Promise<ArticleMutationResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "Your admin session has expired. Sign in again before saving.",
    };
  }
  try {
    return await updateArticleMetadataFields({
      articleId,
      changes,
      expectedVersion,
      actor,
    });
  } catch {
    return {
      success: false,
      error: "SAVE_FAILED",
      message: "Database save failed.",
    };
  }
}

/**
 * Phase 40 — accept AI suggestion via existing mutation boundaries.
 */
export async function acceptAISuggestionAction(
  suggestionId: string,
  expectedVersion?: number,
): Promise<import("@/lib/ai-suggestions").SuggestionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "Your admin session has expired. Sign in again.",
    };
  }
  const { acceptSuggestion } = await import("@/lib/ai-suggestions");
  try {
    return await acceptSuggestion({
      suggestionId,
      actor,
      expectedVersion,
    });
  } catch {
    return {
      success: false,
      error: "MUTATION_FAILED",
      message: "Failed to accept suggestion.",
    };
  }
}

/**
 * Phase 40 — reject AI suggestion (preserves history).
 */
export async function rejectAISuggestionAction(
  suggestionId: string,
): Promise<import("@/lib/ai-suggestions").SuggestionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "Your admin session has expired. Sign in again.",
    };
  }
  const { rejectSuggestion } = await import("@/lib/ai-suggestions");
  try {
    return await rejectSuggestion({ suggestionId, actor });
  } catch {
    return {
      success: false,
      error: "MUTATION_FAILED",
      message: "Failed to reject suggestion.",
    };
  }
}

type EditorialTaskActionResult =
  | { success: true }
  | { success: false; error: string; message: string };

function taskSessionExpired(): EditorialTaskActionResult {
  return {
    success: false,
    error: "INVALID_INPUT",
    message: "Your admin session has expired. Sign in again.",
  };
}

/**
 * Phase 42 — create editorial task (operational only, no content mutation).
 */
export async function createEditorialTaskAction(
  input: Omit<
    import("@/lib/editorial-tasks").CreateEditorialTaskInput,
    "createdBy"
  >,
): Promise<EditorialTaskActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return taskSessionExpired();
  }
  const { createEditorialTask } = await import("@/lib/editorial-tasks");
  const result = await createEditorialTask({ ...input, createdBy: actor });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function createTaskFromRecommendationAction(
  recommendationId: string,
): Promise<EditorialTaskActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return taskSessionExpired();
  }
  const { createTaskFromRecommendation } = await import("@/lib/editorial-tasks");
  const result = await createTaskFromRecommendation({
    recommendationId,
    createdBy: actor,
    assignee: actor,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function createTaskFromSuggestionAction(
  suggestionId: string,
): Promise<EditorialTaskActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return taskSessionExpired();
  }
  const { createTaskFromSuggestion } = await import("@/lib/editorial-tasks");
  const result = await createTaskFromSuggestion({
    suggestionId,
    createdBy: actor,
    assignee: actor,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function assignEditorialTaskAction(
  taskId: string,
  assignee: string,
): Promise<EditorialTaskActionResult> {
  try {
    await requireAdmin();
  } catch {
    return taskSessionExpired();
  }
  const { assignTask } = await import("@/lib/editorial-tasks");
  const result = await assignTask({ taskId, assignee });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function updateEditorialTaskStatusAction(
  taskId: string,
  status: import("@/types/editorial-task").EditorialTaskStatus,
): Promise<EditorialTaskActionResult> {
  try {
    await requireAdmin();
  } catch {
    return taskSessionExpired();
  }
  const { updateTaskStatus } = await import("@/lib/editorial-tasks");
  const result = await updateTaskStatus({ taskId, status });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function completeEditorialTaskAction(
  taskId: string,
): Promise<EditorialTaskActionResult> {
  try {
    await requireAdmin();
  } catch {
    return taskSessionExpired();
  }
  const { completeTask } = await import("@/lib/editorial-tasks");
  const result = await completeTask(taskId);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

type AIAssistanceActionResult =
  | { success: true }
  | { success: false; error: string; message: string };

function assistanceSessionExpired(): AIAssistanceActionResult {
  return {
    success: false,
    error: "INVALID_INPUT",
    message: "Your admin session has expired. Sign in again.",
  };
}

/**
 * Phase 43 — generate / review AI assistance (no canonical writes).
 */
export async function generateAIAssistanceAction(
  entityType: "product" | "article",
  entityId: string,
  type: import("@/types/ai-assistance").AIAssistanceType,
): Promise<AIAssistanceActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return assistanceSessionExpired();
  }
  const { generateAssistance } = await import("@/lib/ai-assistance");
  const result = await generateAssistance({
    entityType,
    entityId,
    type,
    createdBy: actor,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function acceptAIAssistanceAction(
  id: string,
): Promise<AIAssistanceActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return assistanceSessionExpired();
  }
  const { acceptAssistance } = await import("@/lib/ai-assistance");
  const result = await acceptAssistance(id, actor);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function rejectAIAssistanceAction(
  id: string,
): Promise<AIAssistanceActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return assistanceSessionExpired();
  }
  const { rejectAssistance } = await import("@/lib/ai-assistance");
  const result = await rejectAssistance(id, actor);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

export async function markAIAssistanceReviewedAction(
  id: string,
): Promise<AIAssistanceActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return assistanceSessionExpired();
  }
  const { markAssistanceReviewed } = await import("@/lib/ai-assistance");
  const result = await markAssistanceReviewed(id, actor);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

/**
 * Phase 45 — structured human feedback (evaluation only; no content mutation).
 */
export async function submitAIAssistanceFeedbackAction(input: {
  assistanceId: string;
  disposition: string;
  reason: string;
  note?: string | null;
}): Promise<AIAssistanceActionResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return assistanceSessionExpired();
  }
  const { submitAssistanceFeedback } = await import("@/lib/ai-feedback");
  const result = await submitAssistanceFeedback({
    assistanceId: input.assistanceId,
    disposition: input.disposition,
    reason: input.reason,
    note: input.note ?? null,
    actor,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
    };
  }
  return { success: true };
}

function workflowSessionExpired(): WorkflowResult {
  return {
    success: false,
    error: "INVALID_INPUT",
    message: "Your admin session has expired. Sign in again.",
  };
}

export async function getEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
) {
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  return getWorkflowStatus(entityType, entityId);
}

export async function createEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<WorkflowResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return workflowSessionExpired();
  }
  return createWorkflowRecord({ entityType, entityId, actor });
}

export async function submitEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<WorkflowResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return workflowSessionExpired();
  }
  return submitForReview({ entityType, entityId, actor });
}

export async function approveEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<WorkflowResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return workflowSessionExpired();
  }
  return approveChange({ entityType, entityId, actor });
}

export async function publishEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<WorkflowResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return workflowSessionExpired();
  }
  return publishChange({ entityType, entityId, actor });
}

export async function reopenEditorialWorkflowAction(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<WorkflowResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return workflowSessionExpired();
  }
  return reopenForEdit({ entityType, entityId, actor });
}

export async function saveAdminArticleAction(
  article: ArticleV1,
  expectedVersion?: number,
  body?: string,
): Promise<AdminSaveResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return expired();
  }
  try {
    return await saveAdminArticle(article, { expectedVersion, body, actor });
  } catch {
    return databaseFailed();
  }
}

export async function previewAdminArticleMarkdownAction(
  markdown: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Your admin session has expired. Sign in again." };
  }
  if (typeof markdown !== "string") {
    return { ok: false, error: "Article body must be a string." };
  }
  const { renderArticleMarkdown } = await import("@/lib/markdown/render-article-body");
  return { ok: true, html: renderArticleMarkdown(markdown) };
}

export async function createAdminArticleAction(
  article: ArticleV1,
  body?: string,
): Promise<AdminSaveResult> {
  try {
    await requireAdmin();
  } catch {
    return expired();
  }
  try {
    return await createAdminArticle(article, body ? { body } : undefined);
  } catch {
    return databaseFailed();
  }
}

export async function createAdminProductAction(
  product: ProductV1Document,
): Promise<AdminSaveResult> {
  try {
    await requireAdmin();
  } catch {
    return expired();
  }
  try {
    return await createAdminProduct(product);
  } catch {
    return databaseFailed();
  }
}

export async function loadAdminProductAction(
  id: string,
): Promise<AdminProductRecord | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Your admin session has expired. Sign in again before saving." };
  }
  const record = await getAdminProduct(id);
  return record ?? { error: `Product not found: ${id}` };
}

export async function loadAdminArticleAction(
  id: string,
): Promise<AdminArticleRecord | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Your admin session has expired. Sign in again before saving." };
  }
  const record = await getAdminArticle(id);
  return record ?? { error: `Article not found: ${id}` };
}

export async function loadArticleRevisionHistoryAction(articleId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Unauthorized" as const };
  }
  const record = await getAdminArticle(articleId);
  if (!record) return { error: "Article not found" as const };
  const revisions = await listArticleRevisionItems(articleId);
  return {
    article: record.article,
    version: record.version,
    revisions,
  };
}

export async function loadProductRevisionHistoryAction(productId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Unauthorized" as const };
  }
  const record = await getAdminProduct(productId);
  if (!record) return { error: "Product not found" as const };
  const revisions = await listProductRevisionItems(productId);
  return {
    product: record.product,
    version: record.version,
    revisions,
  };
}

export async function loadArticleRevisionDetailAction(articleId: string, revisionId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Unauthorized" as const };
  }
  const detail = await getArticleRevisionDetail(articleId, revisionId);
  return detail ?? { error: "Revision not found" as const };
}

export async function loadProductRevisionDetailAction(productId: string, revisionId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Unauthorized" as const };
  }
  const detail = await getProductRevisionDetail(productId, revisionId);
  return detail ?? { error: "Revision not found" as const };
}

export async function restoreArticleRevisionAction(
  articleId: string,
  revisionId: string,
  expectedVersion: number,
): Promise<AdminSaveResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return expired();
  }
  try {
    return await restoreArticleRevision(articleId, revisionId, { expectedVersion, actor });
  } catch {
    return databaseFailed();
  }
}

export async function restoreProductRevisionAction(
  productId: string,
  revisionId: string,
  expectedVersion: number,
): Promise<AdminSaveResult> {
  let actor: string;
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return expired();
  }
  try {
    return await restoreProductRevision(productId, revisionId, { expectedVersion, actor });
  } catch {
    return databaseFailed();
  }
}

export async function getArticleRevisionCountAction(articleId: string): Promise<number> {
  try {
    await requireAdmin();
  } catch {
    return 0;
  }
  return getArticleRevisionCount(articleId);
}

export async function getProductRevisionCountAction(productId: string): Promise<number> {
  try {
    await requireAdmin();
  } catch {
    return 0;
  }
  return getProductRevisionCount(productId);
}

export async function evaluateArticleReadinessAction(
  article: import("@/types/article-v1").ArticleV1,
  body: string,
): Promise<import("@/lib/editorial/article-readiness").ArticleReadinessResult> {
  try {
    await requireAdmin();
  } catch {
    return { ready: false, blockers: [{ id: "auth", label: "Auth", severity: "blocker", message: "Session expired.", section: "System" }], warnings: [], checks: [] };
  }
  const { evaluateArticleReadiness } = await import("@/lib/editorial/article-readiness");
  const { listProductsV1 } = await import("@/lib/content/products");
  const { listArticlesV1 } = await import("@/lib/content/articles");
  const products = await listProductsV1();
  const allArticles = await listArticlesV1();
  const knownSlugs = new Set(allArticles.map((a) => a.identity.slug));
  return evaluateArticleReadiness(article, body, products, { knownSlugs });
}

export type ContentGraphData = {
  overview: import("@/lib/editorial/content-graph").GraphOverview;
  articles: { id: string; slug: string; title: string; type: string; status: string; category?: string }[];
  products: { id: string; name: string; category: string; referencingArticleIds: string[] }[];
};

export async function loadContentGraphAction(): Promise<ContentGraphData | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  const { listArticlesV1, getArticleV1 } = await import("@/lib/content/articles");
  const { listProductsV1 } = await import("@/lib/content/products");
  const { buildContentGraph, getGraphOverview } = await import("@/lib/editorial/content-graph");
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const bodies = new Map<string, string>();
  for (const a of articles) {
    const record = await getArticleV1(a.identity.id);
    bodies.set(a.identity.id, record?.body ?? "");
  }
  const graph = buildContentGraph(articles, bodies, products);
  const overview = getGraphOverview(graph);
  return {
    overview,
    articles: articles.map((a) => ({ id: a.identity.id, slug: a.identity.slug, title: a.identity.title, type: a.classification.type, status: a.publishing.status, category: a.classification.category })),
    products: [...graph.products.values()].map((p) => ({ id: p.id, name: p.name, category: p.category, referencingArticleIds: p.referencingArticleIds })),
  };
}

export type ArticleLinkProfileData = import("@/lib/editorial/content-graph").ArticleLinkProfile & {
  backlinkOpportunities: import("@/lib/editorial/content-graph").InternalLinkOpportunity[];
};

export async function loadArticleLinkProfileAction(articleId: string): Promise<ArticleLinkProfileData | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  const { listArticlesV1, getArticleV1 } = await import("@/lib/content/articles");
  const { listProductsV1 } = await import("@/lib/content/products");
  const { buildContentGraph, getArticleLinkProfile, findBacklinkOpportunities } = await import("@/lib/editorial/content-graph");
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const bodies = new Map<string, string>();
  for (const a of articles) {
    const record = await getArticleV1(a.identity.id);
    bodies.set(a.identity.id, record?.body ?? "");
  }
  const graph = buildContentGraph(articles, bodies, products);
  const profile = getArticleLinkProfile(articleId, graph);
  const backlinkOpportunities = findBacklinkOpportunities(articleId, graph);
  return { ...profile, backlinkOpportunities };
}

export type AILinkSuggestion = {
  anchorText: string;
  suggestedSentence?: string;
  placementHint?: string;
};

export async function suggestInternalLinkPlacementAction(
  sourceTitle: string,
  sourceSummary: string,
  targetTitle: string,
  targetSummary: string,
  reasons: string[],
): Promise<{ ok: true; suggestion: AILinkSuggestion } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Session expired." };
  }
  try {
    const { getAIClient, getAIModel, isAIConfigured } = await import("@/lib/ai/client");
    if (!isAIConfigured()) return { ok: false, error: "AI Assistant is not configured." };
    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getAIModel(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You suggest internal link anchor text for a blog article. Return JSON with anchorText, suggestedSentence, placementHint. Be concise and accurate. Do not fabricate content about the target article.",
        },
        {
          role: "user",
          content: `Source article: ${sourceTitle}\nSummary: ${sourceSummary}\n\nTarget article: ${targetTitle}\nSummary: ${targetSummary}\n\nRelationship: ${reasons.join("; ")}\n\nSuggest anchor text and a sentence that could naturally include a link to the target article within the source article.`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as AILinkSuggestion;
    return { ok: true, suggestion: { anchorText: parsed.anchorText ?? "", suggestedSentence: parsed.suggestedSentence, placementHint: parsed.placementHint } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI suggestion failed." };
  }
}

export async function analyzeEditorialOpportunitiesAction(): Promise<import("@/lib/ai/planning-types").PlanningResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Your admin session has expired. Sign in again." };
  }
  const { isAIConfigured } = await import("@/lib/ai/client");
  if (!isAIConfigured()) {
    return { ok: false, error: "AI planning is not configured. Set AI_API_KEY." };
  }
  const { listArticlesV1 } = await import("@/lib/content/articles");
  const { listProductsV1 } = await import("@/lib/content/products");
  const { computeCoverageInventory } = await import("@/lib/admin/editorial-coverage");
  const { analyzeEditorialOpportunities } = await import("@/lib/ai/editorial-planning");
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const inventory = computeCoverageInventory(articles, products);
  return analyzeEditorialOpportunities(inventory);
}

export async function loadCoverageInventoryAction(): Promise<import("@/lib/admin/editorial-coverage").CoverageInventory> {
  try {
    await requireAdmin();
  } catch {
    return { articleCount: 0, productCount: 0, articlesByType: {}, articlesByCategory: {}, articlesByIntent: {}, productsByCategory: {}, unusedProducts: [], productsWithoutReview: [], articles: [], products: [] };
  }
  const { listArticlesV1 } = await import("@/lib/content/articles");
  const { listProductsV1 } = await import("@/lib/content/products");
  const { computeCoverageInventory } = await import("@/lib/admin/editorial-coverage");
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  return computeCoverageInventory(articles, products);
}

export async function loadProductsForAIContextAction(
  productIds: string[],
): Promise<import("@/lib/ai/types").AIProductContext[]> {
  try {
    await requireAdmin();
  } catch {
    return [];
  }
  const results: import("@/lib/ai/types").AIProductContext[] = [];
  for (const id of productIds) {
    const record = await getAdminProduct(id);
    if (!record) continue;
    const p = record.product;
    results.push({
      id: p.id,
      name: p.identity.name,
      brand: p.identity.brand,
      category: p.identity.category,
      verdict: p.editorial?.verdict,
      bestFor: p.editorial?.bestFor,
      notFor: p.editorial?.notFor,
      pros: p.editorial?.pros,
      cons: p.editorial?.cons,
      description: p.editorial?.description,
      rating: p.review?.rating,
      specs: p.specs as Record<string, unknown> | undefined,
    });
  }
  return results;
}

export async function aiAssistArticleAction(
  request: import("@/lib/ai/types").AIAssistRequest,
): Promise<import("@/lib/ai/types").AIAssistResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Your admin session has expired. Sign in again." };
  }
  const { isAIConfigured } = await import("@/lib/ai/client");
  if (!isAIConfigured()) {
    return { ok: false, error: "AI Assistant is not configured. Set AI_API_KEY." };
  }
  const { runEditorialAssist } = await import("@/lib/ai/editorial-assistant");
  return runEditorialAssist(request);
}

export type SearchIntelligenceResult =
  | { ok: true; data: import("@/lib/search-console/types").SearchIntelligenceData }
  | { ok: false; error: string; configured: boolean };

export async function loadSearchIntelligenceAction(
  dateWindow: import("@/lib/search-console/types").SearchDateWindow = 28,
  options?: { refresh?: boolean },
): Promise<SearchIntelligenceResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Session expired.", configured: false };
  }

  const { isGSCConfigured, fetchPageMetrics, fetchPageQueryMetrics, fetchQueryMetrics } =
    await import("@/lib/search-console/client");
  const { buildSearchIntelligence } =
    await import("@/lib/search-console/queries");
  const { dateRangeForWindow } = await import("@/lib/search-console/normalize");
  const { clearSearchConsoleCache } = await import("@/lib/search-console/cache");

  if (!isGSCConfigured()) {
    return {
      ok: false,
      error: "Google Search Console is not configured.",
      configured: false,
    };
  }

  if (options?.refresh) clearSearchConsoleCache();

  try {
    const { listArticlesV1, getArticleV1 } = await import("@/lib/content/articles");
    const { listProductsV1 } = await import("@/lib/content/products");
    const { buildContentGraph } = await import("@/lib/editorial/content-graph");

    const articles = await listArticlesV1();
    const products = await listProductsV1();
    const bodies = new Map<string, string>();
    for (const a of articles) {
      const record = await getArticleV1(a.identity.id);
      bodies.set(a.identity.id, record?.body ?? "");
    }
    const graph = buildContentGraph(articles, bodies, products);

    const ranges = dateRangeForWindow(dateWindow);
    const bypass = options?.refresh ?? false;

    const [currentPageRows, previousPageRows, pageQueryRows, queryRows] = await Promise.all([
      fetchPageMetrics(ranges.current.start, ranges.current.end, bypass),
      fetchPageMetrics(ranges.previous.start, ranges.previous.end, bypass),
      fetchPageQueryMetrics(ranges.current.start, ranges.current.end, bypass),
      fetchQueryMetrics(ranges.current.start, ranges.current.end, bypass),
    ]);

    const data = buildSearchIntelligence(
      articles,
      currentPageRows,
      previousPageRows,
      pageQueryRows,
      queryRows,
      dateWindow,
      graph,
    );

    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Search Console data.";
    return { ok: false, error: message, configured: true };
  }
}

export type AISearchAnalysis = {
  recommendedAction: "UPDATE_EXISTING" | "INTERNAL_LINK" | "CREATE_NEW" | "MONITOR";
  rationale: string;
  suggestedChanges: string[];
};

export async function analyzeSearchOpportunityAction(
  opportunity: import("@/lib/search-console/types").SearchOpportunity,
  articleTitle?: string,
  topQueries?: string[],
): Promise<{ ok: true; analysis: AISearchAnalysis } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Session expired." };
  }
  try {
    const { getAIClient, getAIModel, isAIConfigured } = await import("@/lib/ai/client");
    if (!isAIConfigured()) return { ok: false, error: "AI Assistant is not configured." };

    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getAIModel(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an editorial search analyst for SmartDesk. All search metrics supplied are factual GSC data. Do not invent traffic, rankings, search volume, CTR, or position. Return JSON with recommendedAction (UPDATE_EXISTING|INTERNAL_LINK|CREATE_NEW|MONITOR), rationale, suggestedChanges (array of strings). GSC impressions are not total keyword search volume.",
        },
        {
          role: "user",
          content: JSON.stringify({
            opportunity,
            articleTitle,
            topQueries: topQueries?.slice(0, 10),
          }),
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as AISearchAnalysis;
    return {
      ok: true,
      analysis: {
        recommendedAction: parsed.recommendedAction ?? "MONITOR",
        rationale: parsed.rationale ?? "",
        suggestedChanges: parsed.suggestedChanges ?? [],
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI analysis failed." };
  }
}

export async function loadRefreshQueueAction(
  options?: { refreshSearch?: boolean },
): Promise<import("@/lib/editorial/content-refresh").RefreshQueue | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  try {
    const { loadRefreshQueueData } = await import("@/lib/editorial/refresh-loader");
    return await loadRefreshQueueData(28, options);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load refresh queue." };
  }
}

export type RefreshPlanAction = {
  area: "seo" | "body" | "internal-links" | "products";
  recommendation: string;
  evidence: string;
};

export type RefreshPlan = {
  summary: string;
  actions: RefreshPlanAction[];
};

export async function suggestArticleRefreshPlanAction(
  candidate: import("@/lib/editorial/content-refresh").RefreshCandidate,
): Promise<{ ok: true; plan: RefreshPlan } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Session expired." };
  }
  try {
    const { getAIClient, getAIModel, isAIConfigured } = await import("@/lib/ai/client");
    if (!isAIConfigured()) return { ok: false, error: "AI Assistant is not configured." };

    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getAIModel(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You suggest an editorial refresh plan for a blog article. All search metrics in the input are factual. Do not invent traffic, rankings, CTR, or position. Do not claim Google penalized the article. Return JSON with summary (string) and actions (array of {area, recommendation, evidence}). Suggest 3-5 steps only. No content rewrites.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: candidate.title,
            type: candidate.type,
            priority: candidate.priority,
            reasons: candidate.reasons,
            evidence: candidate.evidence,
            suggestedActions: candidate.suggestedActions,
          }),
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as RefreshPlan;
    return {
      ok: true,
      plan: {
        summary: parsed.summary ?? "",
        actions: parsed.actions ?? [],
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI refresh plan failed." };
  }
}

export async function loadRefreshCandidateAction(
  articleId: string,
): Promise<import("@/lib/editorial/content-refresh").RefreshCandidate | null | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  try {
    const { loadRefreshQueueData } = await import("@/lib/editorial/refresh-loader");
    const { getRefreshCandidate } = await import("@/lib/editorial/content-refresh");
    const queue = await loadRefreshQueueData();
    return getRefreshCandidate(articleId, queue) ?? null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load refresh context." };
  }
}

export async function loadProductMaintenanceQueueAction(): Promise<
  import("@/lib/editorial/product-maintenance").ProductMaintenanceQueue | { error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  try {
    const { loadProductMaintenanceQueueData } = await import("@/lib/editorial/product-maintenance-loader");
    return await loadProductMaintenanceQueueData();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load maintenance queue." };
  }
}

export async function loadProductMaintenanceCandidateAction(
  productId: string,
): Promise<import("@/lib/editorial/product-maintenance").ProductMaintenanceCandidate | null | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  try {
    const { loadProductMaintenanceQueueData } = await import("@/lib/editorial/product-maintenance-loader");
    const { getProductMaintenanceCandidate } = await import("@/lib/editorial/product-maintenance");
    const queue = await loadProductMaintenanceQueueData();
    return getProductMaintenanceCandidate(productId, queue) ?? null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load maintenance context." };
  }
}

export async function getAmazonCommerceProviderStatusAction(): Promise<
  import("@/lib/commerce/types").CommerceProviderStatus | { error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Session expired." };
  }
  const { getCommerceProviderStatus } = await import("@/lib/commerce/provider");
  return getCommerceProviderStatus();
}

export async function lookupAmazonProductByAsinAction(input: {
  productId: string;
  asin: string;
  refresh?: boolean;
}): Promise<import("@/lib/commerce/types").CommerceLookupResult | { error: string }> {
  let actor = "unknown";
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return { error: "Session expired." };
  }
  const { getCommerceProvider } = await import("@/lib/commerce/provider");
  const provider = getCommerceProvider();
  const result = await provider.lookupByAsin(input.asin, { bypassCache: input.refresh });
  console.info("[commerce] lookup", {
    admin: actor,
    productId: input.productId,
    type: "asin",
    success: result.ok,
    code: result.ok ? undefined : result.code,
  });
  return result;
}

export async function searchAmazonProductsAction(input: {
  productId: string;
  name: string;
  brand?: string;
  model?: string;
}): Promise<import("@/lib/commerce/types").CommerceSearchResult | { error: string }> {
  let actor = "unknown";
  try {
    ({ email: actor } = await requireAdmin());
  } catch {
    return { error: "Session expired." };
  }
  const { getCommerceProvider } = await import("@/lib/commerce/provider");
  const provider = getCommerceProvider();
  const result = await provider.searchProducts({
    name: input.name,
    brand: input.brand,
    model: input.model,
  });
  console.info("[commerce] lookup", {
    admin: actor,
    productId: input.productId,
    type: "search",
    success: result.ok,
    code: result.ok ? undefined : result.code,
  });
  return result;
}
