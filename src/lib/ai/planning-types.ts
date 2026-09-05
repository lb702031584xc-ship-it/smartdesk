export type OpportunityType =
  | "best-list-gap"
  | "review-gap"
  | "comparison-gap"
  | "guide-gap"
  | "informational-gap"
  | "internal-link-opportunity"
  | "catalog-gap";

export type EditorialOpportunity = {
  title: string;
  articleType: string;
  intent: string;
  category?: string;
  opportunityType: OpportunityType;
  rationale: string;
  coverageGap: string;
  suggestedProductIds: string[];
  primaryKeywordSuggestion?: string;
  priority: "high" | "medium" | "low";
  relatedExistingArticleIds?: string[];
};

export type PlanningResult =
  | { ok: true; opportunities: EditorialOpportunity[]; catalogGaps: string[] }
  | { ok: false; error: string };
