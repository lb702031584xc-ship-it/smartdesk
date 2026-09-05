import { getAIClient, getAIModel } from "./client";
import { EDITORIAL_SYSTEM_PROMPT } from "./system-prompt";
import type { CoverageInventory } from "@/lib/admin/editorial-coverage";
import type { EditorialOpportunity, OpportunityType, PlanningResult } from "./planning-types";

const VALID_OPPORTUNITY_TYPES: OpportunityType[] = [
  "best-list-gap", "review-gap", "comparison-gap", "guide-gap",
  "informational-gap", "internal-link-opportunity", "catalog-gap",
];
const VALID_ARTICLE_TYPES = ["best-list", "review", "comparison", "guide", "how-to", "informational"];
const VALID_INTENTS = ["informational", "commercial", "transactional", "mixed"];
const VALID_PRIORITIES = ["high", "medium", "low"] as const;

function buildPlanningContext(inventory: CoverageInventory): string {
  const parts: string[] = [];
  parts.push(`Content inventory: ${inventory.articleCount} Articles, ${inventory.productCount} Products`);
  parts.push(`\nArticles by type: ${JSON.stringify(inventory.articlesByType)}`);
  parts.push(`Articles by category: ${JSON.stringify(inventory.articlesByCategory)}`);
  parts.push(`Articles by intent: ${JSON.stringify(inventory.articlesByIntent)}`);
  parts.push(`Products by category: ${JSON.stringify(inventory.productsByCategory)}`);

  parts.push("\nExisting articles:");
  for (const a of inventory.articles) {
    parts.push(`  - "${a.title}" (${a.type}, ${a.category ?? "no-category"}, ${a.intent}, products: [${a.productIds.join(", ")}])`);
  }

  parts.push("\nProduct catalog:");
  for (const p of inventory.products) {
    parts.push(`  - ${p.id}: ${p.name} (${p.category}${p.subcategory ? "/" + p.subcategory : ""}) — articles: ${p.articleCount}, reviews: ${p.reviewCount}, best-lists: ${p.bestListCount}, comparisons: ${p.comparisonCount}`);
  }

  if (inventory.unusedProducts.length > 0) {
    parts.push(`\nProducts with 0 article references: ${inventory.unusedProducts.map((p) => p.id).join(", ")}`);
  }
  if (inventory.productsWithoutReview.length > 0) {
    parts.push(`Products without dedicated review: ${inventory.productsWithoutReview.map((p) => p.id).join(", ")}`);
  }

  return parts.join("\n");
}

const PLANNING_PROMPT = `Analyze the SmartDesk content inventory and suggest 6 editorial opportunities.

For each opportunity return a JSON object with:
- title (string): suggested article title
- articleType (string): one of: best-list, review, comparison, guide, how-to, informational
- intent (string): one of: informational, commercial, transactional, mixed
- category (string, optional): content category
- opportunityType (string): one of: best-list-gap, review-gap, comparison-gap, guide-gap, informational-gap, internal-link-opportunity, catalog-gap
- rationale (string): 1-2 sentences why this matters
- coverageGap (string): what specific gap this fills
- suggestedProductIds (string[]): ONLY product IDs from the supplied catalog. Empty array if none.
- primaryKeywordSuggestion (string, optional): suggested keyword
- priority (string): high, medium, or low
- relatedExistingArticleIds (string[], optional): IDs of related existing articles from the supplied inventory

Rules:
- Use ONLY product IDs and article IDs from the supplied inventory.
- Do NOT invent products or articles not in the data.
- Do NOT make external search volume or traffic claims.
- Do NOT say "high search volume" or "low competition" — you have no external SEO data.
- Distinguish content gaps (can create article with existing products) from catalog gaps (no products exist to support article).
- For catalog-gap opportunities, set suggestedProductIds to empty array.
- Avoid suggesting topics that substantially duplicate existing articles.
- Keep rationale concise.

Return a JSON object with:
{
  "opportunities": [...],
  "catalogGaps": ["description of missing catalog areas"]
}

Return ONLY the JSON object.`;

function parseJsonSafe(text: string): unknown {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

function validateOpportunity(
  data: unknown,
  validProductIds: Set<string>,
  validArticleIds: Set<string>,
): EditorialOpportunity | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (typeof d.title !== "string" || !d.title.trim()) return null;
  if (typeof d.articleType !== "string" || !VALID_ARTICLE_TYPES.includes(d.articleType)) return null;
  if (typeof d.intent !== "string" || !VALID_INTENTS.includes(d.intent)) return null;
  if (typeof d.rationale !== "string") return null;
  if (typeof d.coverageGap !== "string") return null;
  if (typeof d.priority !== "string" || !VALID_PRIORITIES.includes(d.priority as typeof VALID_PRIORITIES[number])) return null;

  const oppType = typeof d.opportunityType === "string" && VALID_OPPORTUNITY_TYPES.includes(d.opportunityType as OpportunityType)
    ? (d.opportunityType as OpportunityType)
    : "guide-gap";

  const productIds: string[] = [];
  if (Array.isArray(d.suggestedProductIds)) {
    for (const id of d.suggestedProductIds) {
      if (typeof id !== "string") continue;
      if (!validProductIds.has(id)) return null;
      productIds.push(id);
    }
  }

  const relatedIds: string[] = [];
  if (Array.isArray(d.relatedExistingArticleIds)) {
    for (const id of d.relatedExistingArticleIds) {
      if (typeof id === "string" && validArticleIds.has(id)) {
        relatedIds.push(id);
      }
    }
  }

  return {
    title: d.title.trim(),
    articleType: d.articleType,
    intent: d.intent,
    category: typeof d.category === "string" ? d.category : undefined,
    opportunityType: oppType,
    rationale: d.rationale,
    coverageGap: d.coverageGap,
    suggestedProductIds: productIds,
    primaryKeywordSuggestion: typeof d.primaryKeywordSuggestion === "string" ? d.primaryKeywordSuggestion : undefined,
    priority: d.priority as "high" | "medium" | "low",
    relatedExistingArticleIds: relatedIds.length > 0 ? relatedIds : undefined,
  };
}

export async function analyzeEditorialOpportunities(
  inventory: CoverageInventory,
): Promise<PlanningResult> {
  const client = getAIClient();
  const model = getAIModel();
  const context = buildPlanningContext(inventory);

  console.log(`[ai-planning] model=${model} articles=${inventory.articleCount} products=${inventory.productCount}`);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 3000,
      messages: [
        { role: "system", content: EDITORIAL_SYSTEM_PROMPT + "\n\nDo not suggest products outside the supplied catalog." },
        { role: "user", content: `${PLANNING_PROMPT}\n\n---\n${context}` },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return { ok: false, error: "AI returned empty response." };

    const parsed = parseJsonSafe(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "AI returned invalid JSON." };
    }

    const validProductIds = new Set(inventory.products.map((p) => p.id));
    const validArticleIds = new Set(inventory.articles.map((a) => a.id));

    const opportunities: EditorialOpportunity[] = [];
    if (Array.isArray(parsed.opportunities)) {
      for (const item of parsed.opportunities) {
        const opp = validateOpportunity(item, validProductIds, validArticleIds);
        if (opp) opportunities.push(opp);
      }
    }

    const catalogGaps: string[] = [];
    if (Array.isArray(parsed.catalogGaps)) {
      for (const g of parsed.catalogGaps) {
        if (typeof g === "string") catalogGaps.push(g);
      }
    }

    if (opportunities.length === 0 && catalogGaps.length === 0) {
      return { ok: false, error: "AI returned no valid opportunities." };
    }

    return { ok: true, opportunities, catalogGaps };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-planning] error: ${message}`);
    return { ok: false, error: `AI planning request failed: ${message}` };
  }
}
