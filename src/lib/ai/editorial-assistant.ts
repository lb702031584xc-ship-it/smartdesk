import { getAIClient, getAIModel } from "./client";
import { EDITORIAL_SYSTEM_PROMPT } from "./system-prompt";
import type {
  AIAssistRequest,
  AIAssistResult,
  AIDraftOutline,
  AIDraftProductRef,
  AIDraftProposal,
  AIFaqItem,
  AISeoSuggestion,
} from "./types";

const MAX_BODY_CHARS = 12000;

function truncateBody(body?: string): string {
  if (!body) return "(empty)";
  if (body.length <= MAX_BODY_CHARS) return body;
  return body.slice(0, MAX_BODY_CHARS) + "\n\n[…body truncated for context limit]";
}

function buildContextBlock(req: AIAssistRequest): string {
  const a = req.articleContext;
  const parts: string[] = [
    `Article title: ${a.title}`,
    `Type: ${a.type}`,
  ];
  if (a.category) parts.push(`Category: ${a.category}`);
  if (a.intent) parts.push(`Search intent: ${a.intent}`);
  if (a.summary) parts.push(`Current summary: ${a.summary}`);

  if (req.action === "improve-body" || req.action === "suggest-key-takeaways") {
    parts.push(`\nArticle body:\n${truncateBody(a.body)}`);
  } else if (req.action === "suggest-seo") {
    parts.push(`Body excerpt:\n${truncateBody(a.body)}`);
    if (a.currentSeo) {
      parts.push(`Current SEO: ${JSON.stringify(a.currentSeo)}`);
    }
  } else if (req.action === "suggest-faq") {
    parts.push(`Body excerpt:\n${truncateBody(a.body)}`);
    if (a.currentFaq?.length) {
      parts.push(`Existing FAQ: ${JSON.stringify(a.currentFaq)}`);
    }
  }

  if (req.action === "generate-outline" || req.action === "generate-draft") {
    if (a.body) parts.push(`\nExisting body:\n${truncateBody(a.body)}`);
  }

  if (req.productContext?.length) {
    parts.push("\nReferenced products:");
    for (const p of req.productContext) {
      parts.push(JSON.stringify(p, null, 2));
    }
  }

  return parts.join("\n");
}

function actionPrompt(req: AIAssistRequest): string {
  const custom = req.instruction ? `\nEditor instruction: ${req.instruction}` : "";

  switch (req.action) {
    case "improve-summary":
      return `Improve the article summary. Return only the improved summary text, no JSON wrapper.${custom}`;
    case "suggest-seo":
      return `Suggest SEO metadata for this article. Return a JSON object with optional fields: metaTitle (string, ≤60 chars), metaDescription (string, ≤160 chars), primaryKeyword (string), secondaryKeywords (string[]). Return ONLY the JSON object.${custom}`;
    case "suggest-key-takeaways":
      return `Suggest 3-6 key takeaways for this article. Return a JSON array of strings. Return ONLY the JSON array.${custom}`;
    case "suggest-faq":
      return `Suggest 3-5 FAQ items for this article. Each item should have "question" and "answer" fields. Do not duplicate questions already in the existing FAQ if provided. Return a JSON array of objects. Return ONLY the JSON array.${custom}`;
    case "improve-body":
      return `Improve the article Markdown body. Preserve all existing headings structure, links, and factual claims supported by supplied product data. Return only the improved Markdown text.${custom}`;
    case "generate-outline":
      return `Generate an article outline/plan for a new ${req.articleContext.type} article. Return a JSON object with: titleSuggestion (string), summary (string), seo (object with metaTitle, metaDescription, primaryKeyword, secondaryKeywords), sections (string[] of section headings), faq (array of {question, answer}). Do NOT include publishing status, featured, or scheduling fields. Return ONLY the JSON object.${custom}`;
    case "generate-draft":
      return `Generate a complete draft for a new ${req.articleContext.type} article. Return a JSON object with: titleSuggestion (string), summary (string), seo (object with metaTitle, metaDescription, primaryKeyword, secondaryKeywords), productRefs (array of {productId, summary, verdict, bestFor} using ONLY the supplied product IDs), faq (array of {question, answer}), bodyMarkdown (string with full Markdown body). Do NOT include publishing status, featured, scheduling, rank, role, or winnerId fields. Do NOT invent product IDs not in the supplied products. Do NOT duplicate structured data (FAQ, product cards) in the Markdown body if they are rendered separately by the template. The body should complement, not repeat, structured metadata. Return ONLY the JSON object.${custom}`;
  }
}

function parseJsonSafe(text: string): unknown {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

function validateSeoSuggestion(data: unknown): AISeoSuggestion | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const result: AISeoSuggestion = {};
  if (typeof d.metaTitle === "string") result.metaTitle = d.metaTitle;
  if (typeof d.metaDescription === "string") result.metaDescription = d.metaDescription;
  if (typeof d.primaryKeyword === "string") result.primaryKeyword = d.primaryKeyword;
  if (Array.isArray(d.secondaryKeywords) && d.secondaryKeywords.every((k: unknown) => typeof k === "string")) {
    result.secondaryKeywords = d.secondaryKeywords;
  }
  if (!result.metaTitle && !result.metaDescription && !result.primaryKeyword) return null;
  return result;
}

function validateFaqSuggestion(data: unknown): AIFaqItem[] | null {
  if (!Array.isArray(data)) return null;
  const items: AIFaqItem[] = [];
  for (const item of data) {
    if (typeof item === "object" && item && typeof (item as Record<string, unknown>).question === "string" && typeof (item as Record<string, unknown>).answer === "string") {
      items.push({ question: (item as Record<string, string>).question, answer: (item as Record<string, string>).answer });
    }
  }
  return items.length > 0 ? items : null;
}

function validateKeyTakeaways(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;
  const items = data.filter((i): i is string => typeof i === "string");
  return items.length > 0 ? items : null;
}

function validateOutline(data: unknown): AIDraftOutline | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const result: AIDraftOutline = {};
  if (typeof d.titleSuggestion === "string") result.titleSuggestion = d.titleSuggestion;
  if (typeof d.summary === "string") result.summary = d.summary;
  if (d.seo) result.seo = validateSeoSuggestion(d.seo) ?? undefined;
  if (Array.isArray(d.sections)) {
    result.sections = d.sections.filter((s): s is string => typeof s === "string");
  }
  if (Array.isArray(d.faq)) result.faq = validateFaqSuggestion(d.faq) ?? undefined;
  if (!result.titleSuggestion && !result.summary && !result.sections?.length) return null;
  return result;
}

function validateDraftProposal(
  data: unknown,
  validProductIds: Set<string>,
): AIDraftProposal | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.bodyMarkdown !== "string" || !d.bodyMarkdown.trim()) return null;

  const result: AIDraftProposal = { bodyMarkdown: d.bodyMarkdown };
  if (typeof d.titleSuggestion === "string") result.titleSuggestion = d.titleSuggestion;
  if (typeof d.summary === "string") result.summary = d.summary;
  if (d.seo) result.seo = validateSeoSuggestion(d.seo) ?? undefined;
  if (Array.isArray(d.faq)) result.faq = validateFaqSuggestion(d.faq) ?? undefined;

  if (Array.isArray(d.productRefs)) {
    const refs: AIDraftProductRef[] = [];
    for (const r of d.productRefs) {
      if (!r || typeof r !== "object") continue;
      const ref = r as Record<string, unknown>;
      if (typeof ref.productId !== "string") continue;
      if (!validProductIds.has(ref.productId)) {
        return null; // reject unknown product IDs
      }
      refs.push({
        productId: ref.productId,
        summary: typeof ref.summary === "string" ? ref.summary : undefined,
        verdict: typeof ref.verdict === "string" ? ref.verdict : undefined,
        bestFor: typeof ref.bestFor === "string" ? ref.bestFor : undefined,
      });
    }
    if (refs.length > 0) result.productRefs = refs;
  }

  return result;
}

export async function runEditorialAssist(req: AIAssistRequest): Promise<AIAssistResult> {
  const client = getAIClient();
  const model = getAIModel();

  const context = buildContextBlock(req);
  const userPrompt = `${actionPrompt(req)}\n\n---\n${context}`;

  console.log(`[ai] action=${req.action} model=${model} article="${req.articleContext.title}"`);

  try {
    const maxTokens = req.action === "generate-draft" ? 4000 : 2000;
    const response = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: EDITORIAL_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "AI returned empty response." };
    }

    switch (req.action) {
      case "improve-summary":
        return { ok: true, action: "improve-summary", suggestion: { text: content } };

      case "improve-body":
        return { ok: true, action: "improve-body", suggestion: { text: content } };

      case "suggest-seo": {
        const parsed = parseJsonSafe(content);
        const seo = validateSeoSuggestion(parsed);
        if (!seo) return { ok: false, error: "AI returned invalid SEO suggestion format." };
        return { ok: true, action: "suggest-seo", suggestion: seo };
      }

      case "suggest-key-takeaways": {
        const parsed = parseJsonSafe(content);
        const takeaways = validateKeyTakeaways(parsed);
        if (!takeaways) return { ok: false, error: "AI returned invalid key takeaways format." };
        return { ok: true, action: "suggest-key-takeaways", suggestion: takeaways };
      }

      case "suggest-faq": {
        const parsed = parseJsonSafe(content);
        const faq = validateFaqSuggestion(parsed);
        if (!faq) return { ok: false, error: "AI returned invalid FAQ suggestion format." };
        return { ok: true, action: "suggest-faq", suggestion: faq };
      }

      case "generate-outline": {
        const parsed = parseJsonSafe(content);
        const outline = validateOutline(parsed);
        if (!outline) return { ok: false, error: "AI returned invalid outline format." };
        return { ok: true, action: "generate-outline", suggestion: outline };
      }

      case "generate-draft": {
        const parsed = parseJsonSafe(content);
        const validIds = new Set((req.productContext ?? []).map((p) => p.id));
        const draft = validateDraftProposal(parsed, validIds);
        if (!draft) return { ok: false, error: "AI returned invalid draft format or referenced unknown product IDs." };
        return { ok: true, action: "generate-draft", suggestion: draft };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai] error: ${message}`);
    return { ok: false, error: `AI request failed: ${message}` };
  }
}
