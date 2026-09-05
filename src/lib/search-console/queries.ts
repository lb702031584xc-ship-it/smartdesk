import type { ArticleV1 } from "@/types/article-v1";
import type {
  ArticleSearchProfile,
  GSCQueryMetric,
  GSCRow,
  MappedPageMetric,
  PeriodMetrics,
  SearchDateWindow,
  SearchIntelligenceData,
  SearchOverview,
  UnmappedPage,
} from "./types";
import {
  aggregateRows,
  dateRangeForWindow,
  mapGscPageToSlug,
  safePercentChange,
} from "./normalize";
import { deriveSearchOpportunities } from "./opportunities";
import { getLastFetchedAt } from "./cache";
import { isGSCConfigured } from "./client";
import type { ContentGraph } from "@/lib/editorial/content-graph";
import { getArticleLinkProfile } from "@/lib/editorial/content-graph";

function rowToPeriod(row: { clicks: number; impressions: number; ctr: number; position: number }): PeriodMetrics {
  return { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position };
}

export function mapPageRows(rows: GSCRow[], articles: ArticleV1[]): {
  mapped: MappedPageMetric[];
  unmapped: UnmappedPage[];
} {
  const slugToArticle = new Map(articles.map((a) => [a.identity.slug, a]));
  const mapped: MappedPageMetric[] = [];
  const unmapped: UnmappedPage[] = [];

  for (const row of rows) {
    const page = row.keys[0] ?? "";
    const metric = {
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
    const result = mapGscPageToSlug(page);
    if (result?.slug && slugToArticle.has(result.slug)) {
      const article = slugToArticle.get(result.slug)!;
      mapped.push({
        ...metric,
        articleSlug: result.slug,
        articleId: article.identity.id,
      });
    } else if (result) {
      unmapped.push(metric);
    } else {
      unmapped.push(metric);
    }
  }

  return { mapped, unmapped };
}

export function buildArticleProfiles(
  articles: ArticleV1[],
  currentPageRows: GSCRow[],
  previousPageRows: GSCRow[],
  pageQueryRows: GSCRow[],
): ArticleSearchProfile[] {
  const { mapped: currentMapped } = mapPageRows(currentPageRows, articles);
  const { mapped: previousMapped } = mapPageRows(previousPageRows, articles);

  const currentByArticle = new Map<string, MappedPageMetric[]>();
  for (const m of currentMapped) {
    if (!m.articleId) continue;
    if (!currentByArticle.has(m.articleId)) currentByArticle.set(m.articleId, []);
    currentByArticle.get(m.articleId)!.push(m);
  }

  const previousByArticle = new Map<string, MappedPageMetric[]>();
  for (const m of previousMapped) {
    if (!m.articleId) continue;
    if (!previousByArticle.has(m.articleId)) previousByArticle.set(m.articleId, []);
    previousByArticle.get(m.articleId)!.push(m);
  }

  const queriesBySlug = new Map<string, GSCQueryMetric[]>();
  for (const row of pageQueryRows) {
    const page = row.keys[0] ?? "";
    const query = row.keys[1] ?? "";
    const result = mapGscPageToSlug(page);
    if (!result?.slug) continue;
    if (!queriesBySlug.has(result.slug)) queriesBySlug.set(result.slug, []);
    queriesBySlug.get(result.slug)!.push({
      query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }

  const profiles: ArticleSearchProfile[] = [];

  for (const article of articles) {
    if (article.publishing.status !== "published") continue;
    const currentRows = currentByArticle.get(article.identity.id) ?? [];
    const previousRows = previousByArticle.get(article.identity.id) ?? [];
    const current = rowToPeriod(aggregateRows(currentRows));
    const previous = previousRows.length > 0 ? rowToPeriod(aggregateRows(previousRows)) : undefined;

    const topQueries = (queriesBySlug.get(article.identity.slug) ?? [])
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20);

    if (current.impressions === 0 && current.clicks === 0 && topQueries.length === 0) continue;

    profiles.push({
      articleId: article.identity.id,
      slug: article.identity.slug,
      title: article.identity.title,
      status: article.publishing.status,
      type: article.classification.type,
      category: article.classification.category,
      current,
      previous,
      topQueries,
      clickChange: previous ? safePercentChange(current.clicks, previous.clicks) : undefined,
      impressionChange: previous
        ? safePercentChange(current.impressions, previous.impressions)
        : undefined,
    });
  }

  return profiles.sort((a, b) => b.current.impressions - a.current.impressions);
}

export function buildSearchIntelligence(
  articles: ArticleV1[],
  currentPageRows: GSCRow[],
  previousPageRows: GSCRow[],
  pageQueryRows: GSCRow[],
  queryRows: GSCRow[],
  dateWindow: SearchDateWindow,
  graph?: ContentGraph,
): SearchIntelligenceData {
  const ranges = dateRangeForWindow(dateWindow);
  const { mapped: currentMapped, unmapped } = mapPageRows(currentPageRows, articles);
  const { mapped: previousMapped } = mapPageRows(previousPageRows, articles);

  const totals = rowToPeriod(aggregateRows(currentMapped));
  const previousTotals =
    previousMapped.length > 0
      ? rowToPeriod(aggregateRows(previousMapped))
      : undefined;

  const articleProfiles = buildArticleProfiles(
    articles,
    currentPageRows,
    previousPageRows,
    pageQueryRows,
  );

  const inboundCounts = new Map<string, number>();
  if (graph) {
    for (const profile of articleProfiles) {
      const linkProfile = getArticleLinkProfile(profile.articleId, graph);
      inboundCounts.set(profile.articleId, linkProfile.inboundArticleIds.length);
    }
  }

  const opportunities = deriveSearchOpportunities({
    articleProfiles,
    queryRows,
    articles,
    inboundCounts,
    graph,
  });

  const overview: SearchOverview = {
    configured: isGSCConfigured(),
    lastFetched: getLastFetchedAt(),
    dateWindow,
    currentPeriod: ranges.current,
    previousPeriod: ranges.previous,
    totals,
    previousTotals,
    articlesWithData: articleProfiles.length,
    unmappedPageCount: unmapped.length,
    opportunities,
  };

  return {
    overview,
    articles: articleProfiles,
    unmappedPages: unmapped.sort((a, b) => b.impressions - a.impressions).slice(0, 50),
  };
}

export function emptySearchIntelligence(dateWindow: SearchDateWindow): SearchIntelligenceData {
  const ranges = dateRangeForWindow(dateWindow);
  return {
    overview: {
      configured: isGSCConfigured(),
      dateWindow,
      currentPeriod: ranges.current,
      previousPeriod: ranges.previous,
      totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      articlesWithData: 0,
      unmappedPageCount: 0,
      opportunities: [],
    },
    articles: [],
    unmappedPages: [],
  };
}
