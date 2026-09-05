export type AIActionType =
  | "improve-summary"
  | "suggest-seo"
  | "suggest-key-takeaways"
  | "suggest-faq"
  | "improve-body"
  | "generate-outline"
  | "generate-draft";

export type AISeoSuggestion = {
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
};

export type AIFaqItem = {
  question: string;
  answer: string;
};

export type AITextSuggestion = {
  text: string;
};

export type AIAssistRequest = {
  action: AIActionType;
  articleContext: AIArticleContext;
  productContext?: AIProductContext[];
  instruction?: string;
};

export type AIArticleContext = {
  title: string;
  type: string;
  category?: string;
  intent?: string;
  summary?: string;
  body?: string;
  currentSeo?: AISeoSuggestion;
  currentFaq?: AIFaqItem[];
};

export type AIProductContext = {
  id: string;
  name: string;
  brand: string;
  category: string;
  verdict?: string;
  bestFor?: string[];
  notFor?: string[];
  pros?: string[];
  cons?: string[];
  description?: string;
  rating?: number;
  specs?: Record<string, unknown>;
};

export type AIDraftProductRef = {
  productId: string;
  summary?: string;
  verdict?: string;
  bestFor?: string;
};

export type AIDraftOutline = {
  titleSuggestion?: string;
  summary?: string;
  seo?: AISeoSuggestion;
  sections?: string[];
  faq?: AIFaqItem[];
};

export type AIDraftProposal = {
  titleSuggestion?: string;
  summary?: string;
  seo?: AISeoSuggestion;
  productRefs?: AIDraftProductRef[];
  faq?: AIFaqItem[];
  bodyMarkdown: string;
};

export type AIAssistResult =
  | { ok: true; action: "improve-summary"; suggestion: AITextSuggestion }
  | { ok: true; action: "suggest-seo"; suggestion: AISeoSuggestion }
  | { ok: true; action: "suggest-key-takeaways"; suggestion: string[] }
  | { ok: true; action: "suggest-faq"; suggestion: AIFaqItem[] }
  | { ok: true; action: "improve-body"; suggestion: AITextSuggestion }
  | { ok: true; action: "generate-outline"; suggestion: AIDraftOutline }
  | { ok: true; action: "generate-draft"; suggestion: AIDraftProposal }
  | { ok: false; error: string };
