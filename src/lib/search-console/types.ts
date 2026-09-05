export type SearchDateWindow = 7 | 28 | 90;

export type GSCRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCPageMetric = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCQueryMetric = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type MappedPageMetric = GSCPageMetric & {
  articleSlug: string | null;
  articleId: string | null;
};

export type PeriodMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type ArticleSearchProfile = {
  articleId: string;
  slug: string;
  title: string;
  status: string;
  type: string;
  category?: string;
  current: PeriodMetrics;
  previous?: PeriodMetrics;
  topQueries: GSCQueryMetric[];
  clickChange?: number;
  impressionChange?: number;
};

export type UnmappedPage = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchOpportunityKind =
  | "update-existing"
  | "internal-link"
  | "create-new"
  | "monitor";

export type SearchOpportunityPriority = "high" | "medium" | "low";

export type SearchOpportunity = {
  kind: SearchOpportunityKind;
  priority: SearchOpportunityPriority;
  articleId?: string;
  articleTitle?: string;
  query?: string;
  evidence: PeriodMetrics;
  reasons: string[];
  previous?: PeriodMetrics;
};

export type SearchOverview = {
  configured: boolean;
  lastFetched?: string;
  dateWindow: SearchDateWindow;
  currentPeriod: { start: string; end: string };
  previousPeriod?: { start: string; end: string };
  totals: PeriodMetrics;
  previousTotals?: PeriodMetrics;
  articlesWithData: number;
  unmappedPageCount: number;
  opportunities: SearchOpportunity[];
};

export type SearchIntelligenceData = {
  overview: SearchOverview;
  articles: ArticleSearchProfile[];
  unmappedPages: UnmappedPage[];
};
