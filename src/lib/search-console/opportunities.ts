import type { ArticleV1 } from "@/types/article-v1";
import type {
  ArticleSearchProfile,
  GSCRow,
  SearchOpportunity,
  SearchOpportunityKind,
  SearchOpportunityPriority,
} from "./types";
import type { ContentGraph } from "@/lib/editorial/content-graph";
import { findBacklinkOpportunities } from "@/lib/editorial/content-graph";

const MIN_IMPRESSIONS = 20;
const CTR_REVIEW_MIN_IMPRESSIONS = 50;
const POSITION_OPP_MIN_IMPRESSIONS = 30;
const DECLINE_MIN_PREVIOUS = 10;

function priorityFromImpressions(impressions: number): SearchOpportunityPriority {
  if (impressions >= 200) return "high";
  if (impressions >= 50) return "medium";
  return "low";
}

function addOpportunity(
  list: SearchOpportunity[],
  seen: Set<string>,
  opp: SearchOpportunity,
): void {
  const key = `${opp.kind}:${opp.articleId ?? ""}:${opp.query ?? ""}:${opp.reasons[0] ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(opp);
}

export function deriveSearchOpportunities(input: {
  articleProfiles: ArticleSearchProfile[];
  queryRows: GSCRow[];
  articles: ArticleV1[];
  inboundCounts: Map<string, number>;
  graph?: ContentGraph;
}): SearchOpportunity[] {
  const { articleProfiles, queryRows, articles, inboundCounts, graph } = input;
  const opportunities: SearchOpportunity[] = [];
  const seen = new Set<string>();

  const slugToArticle = new Map(articles.map((a) => [a.identity.slug, a]));

  for (const profile of articleProfiles) {
    const { current, previous } = profile;

    if (
      current.impressions >= CTR_REVIEW_MIN_IMPRESSIONS &&
      current.ctr < 0.04 &&
      current.position <= 15
    ) {
      addOpportunity(opportunities, seen, {
        kind: "update-existing",
        priority: priorityFromImpressions(current.impressions),
        articleId: profile.articleId,
        articleTitle: profile.title,
        evidence: current,
        previous,
        reasons: [
          `${current.impressions} impressions with CTR ${(current.ctr * 100).toFixed(1)}% — title/meta alignment review candidate`,
        ],
      });
    }

    if (
      current.impressions >= POSITION_OPP_MIN_IMPRESSIONS &&
      current.position >= 8 &&
      current.position <= 20
    ) {
      addOpportunity(opportunities, seen, {
        kind: "update-existing",
        priority: priorityFromImpressions(current.impressions),
        articleId: profile.articleId,
        articleTitle: profile.title,
        evidence: current,
        previous,
        reasons: [
          `Avg position ${current.position.toFixed(1)} with ${current.impressions} impressions — position opportunity`,
        ],
      });
    }

    if (previous && previous.clicks >= DECLINE_MIN_PREVIOUS) {
      const clickDrop = previous.clicks - current.clicks;
      const pctDrop = (clickDrop / previous.clicks) * 100;
      if (clickDrop >= 5 && pctDrop >= 20) {
        addOpportunity(opportunities, seen, {
          kind: "update-existing",
          priority: priorityFromImpressions(current.impressions),
          articleId: profile.articleId,
          articleTitle: profile.title,
          evidence: current,
          previous,
          reasons: [
            `Clicks declined ${previous.clicks} → ${current.clicks} (${pctDrop.toFixed(0)}%) — performance decline candidate`,
          ],
        });
      }
    }

    const inbound = inboundCounts.get(profile.articleId) ?? 0;
    if (current.impressions >= MIN_IMPRESSIONS && inbound === 0 && graph) {
      const backlinks = findBacklinkOpportunities(profile.articleId, graph);
      if (backlinks.length > 0) {
        addOpportunity(opportunities, seen, {
          kind: "internal-link",
          priority: priorityFromImpressions(current.impressions),
          articleId: profile.articleId,
          articleTitle: profile.title,
          evidence: current,
          reasons: [
            `${current.impressions} impressions but 0 inbound internal links`,
            `${backlinks.length} backlink opportunities available in Content Graph`,
          ],
        });
      }
    }
  }

  const queryArticleMap = new Map<string, Set<string>>();
  for (const profile of articleProfiles) {
    for (const q of profile.topQueries) {
      if (q.impressions < MIN_IMPRESSIONS) continue;
      if (!queryArticleMap.has(q.query)) queryArticleMap.set(q.query, new Set());
      queryArticleMap.get(q.query)!.add(profile.slug);
    }
  }

  for (const row of queryRows) {
    const query = row.keys[0] ?? "";
    if (row.impressions < MIN_IMPRESSIONS) continue;

    const coveringSlugs = queryArticleMap.get(query) ?? new Set<string>();
    const evidence = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };

    if (coveringSlugs.size === 0) {
      addOpportunity(opportunities, seen, {
        kind: "create-new",
        priority: priorityFromImpressions(row.impressions),
        query,
        evidence,
        reasons: [
          `Query "${query}" has ${row.impressions} impressions but no mapped Article receives them`,
          "Consider whether existing content should be updated before creating new",
        ],
      });
    } else if (coveringSlugs.size === 1) {
      const slug = [...coveringSlugs][0];
      const article = slugToArticle.get(slug);
      if (article && row.impressions >= 50) {
        addOpportunity(opportunities, seen, {
          kind: "monitor",
          priority: "low",
          articleId: article.identity.id,
          articleTitle: article.identity.title,
          query,
          evidence,
          reasons: [
            `Query "${query}" maps to existing Article — monitor before creating overlapping content`,
          ],
        });
      }
    }
  }

  opportunities.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    const kOrder: Record<SearchOpportunityKind, number> = {
      "update-existing": 0,
      "internal-link": 1,
      "create-new": 2,
      monitor: 3,
    };
    const pd = pOrder[a.priority] - pOrder[b.priority];
    if (pd !== 0) return pd;
    return kOrder[a.kind] - kOrder[b.kind];
  });

  return opportunities.slice(0, 30);
}

export function queryCoversArticle(query: string, article: ArticleV1, body?: string): boolean {
  const q = query.toLowerCase();
  const fields = [
    article.identity.title,
    article.editorial.summary,
    article.seo?.metaDescription,
    article.seo?.primaryKeyword,
    ...(article.seo?.secondaryKeywords ?? []),
    ...(article.classification.tags ?? []),
    body,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return fields.includes(q) || q.split(/\s+/).every((word) => word.length > 2 && fields.includes(word));
}
