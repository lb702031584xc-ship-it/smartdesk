import type { ArticleV1 } from "@/types/article-v1";
import type { ArticleReadinessResult } from "@/lib/editorial/article-readiness";
import type { ContentGraph } from "@/lib/editorial/content-graph";
import {
  findBacklinkOpportunities,
  findBrokenInternalLinks,
  getArticleLinkProfile,
  getGraphOverview,
} from "@/lib/editorial/content-graph";
import type {
  ArticleSearchProfile,
  SearchOpportunity,
} from "@/lib/search-console/types";

export type RefreshReasonType =
  | "search-decline"
  | "ctr-review"
  | "position-opportunity"
  | "internal-link-opportunity"
  | "broken-internal-link"
  | "orphan-article"
  | "dead-end-article"
  | "readiness-warning"
  | "content-verification-needed";

export type RefreshPriority = "high" | "medium" | "low";

export type RefreshAction =
  | "edit-content"
  | "review-seo"
  | "fix-internal-link"
  | "add-internal-links"
  | "review-factual-marker"
  | "monitor";

export type RefreshReason = {
  type: RefreshReasonType;
  message: string;
  priority: RefreshPriority;
};

export type RefreshEvidence = {
  search?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    previous?: { clicks: number; impressions: number; ctr: number; position: number };
    topQueries?: string[];
  };
  graph?: {
    inboundLinks: number;
    outboundLinks: number;
    brokenLinks: string[];
    backlinkOpportunityCount: number;
  };
  readiness?: {
    blockers: string[];
    warnings: string[];
  };
};

export type RefreshCandidate = {
  articleId: string;
  title: string;
  slug: string;
  type: string;
  category?: string;
  status: string;
  priority: RefreshPriority;
  reasons: RefreshReason[];
  suggestedActions: RefreshAction[];
  evidence: RefreshEvidence;
};

export type RefreshQueue = {
  candidates: RefreshCandidate[];
  counts: { high: number; medium: number; low: number; total: number };
  gscAvailable: boolean;
};

const PRIORITY_ORDER: Record<RefreshPriority, number> = { high: 0, medium: 1, low: 2 };

function maxPriority(a: RefreshPriority, b: RefreshPriority): RefreshPriority {
  return PRIORITY_ORDER[a] <= PRIORITY_ORDER[b] ? a : b;
}

function actionsForReasons(reasons: RefreshReason[]): RefreshAction[] {
  const actions = new Set<RefreshAction>();
  for (const r of reasons) {
    switch (r.type) {
      case "search-decline":
      case "ctr-review":
      case "position-opportunity":
        actions.add("review-seo");
        actions.add("edit-content");
        break;
      case "internal-link-opportunity":
      case "orphan-article":
        actions.add("add-internal-links");
        break;
      case "broken-internal-link":
        actions.add("fix-internal-link");
        break;
      case "dead-end-article":
        actions.add("add-internal-links");
        break;
      case "readiness-warning":
        actions.add("edit-content");
        break;
      case "content-verification-needed":
        actions.add("review-factual-marker");
        break;
    }
  }
  return [...actions];
}

type CandidateBuilder = {
  articleId: string;
  title: string;
  slug: string;
  type: string;
  category?: string;
  status: string;
  priority: RefreshPriority;
  reasons: RefreshReason[];
  evidence: RefreshEvidence;
};

function getOrCreate(
  map: Map<string, CandidateBuilder>,
  article: ArticleV1,
): CandidateBuilder {
  const existing = map.get(article.identity.id);
  if (existing) return existing;
  const builder: CandidateBuilder = {
    articleId: article.identity.id,
    title: article.identity.title,
    slug: article.identity.slug,
    type: article.classification.type,
    category: article.classification.category,
    status: article.publishing.status,
    priority: "low",
    reasons: [],
    evidence: {},
  };
  map.set(article.identity.id, builder);
  return builder;
}

function addReason(
  builder: CandidateBuilder,
  reason: RefreshReason,
  evidencePatch?: Partial<RefreshEvidence>,
): void {
  const exists = builder.reasons.some((r) => r.type === reason.type && r.message === reason.message);
  if (exists) return;
  builder.reasons.push(reason);
  builder.priority = maxPriority(builder.priority, reason.priority);
  if (evidencePatch?.search) builder.evidence.search = { ...builder.evidence.search, ...evidencePatch.search };
  if (evidencePatch?.graph) builder.evidence.graph = { ...builder.evidence.graph, ...evidencePatch.graph };
  if (evidencePatch?.readiness) {
    builder.evidence.readiness = builder.evidence.readiness ?? { blockers: [], warnings: [] };
    if (evidencePatch.readiness.blockers) {
      builder.evidence.readiness.blockers.push(...evidencePatch.readiness.blockers);
    }
    if (evidencePatch.readiness.warnings) {
      builder.evidence.readiness.warnings.push(...evidencePatch.readiness.warnings);
    }
  }
}

function classifySearchOpportunity(opp: SearchOpportunity): RefreshReason | null {
  if (opp.kind === "create-new" || opp.kind === "monitor") return null;

  if (opp.kind === "internal-link") {
    return {
      type: "internal-link-opportunity",
      priority: opp.priority === "high" ? "medium" : "medium",
      message: opp.reasons.join("; "),
    };
  }

  if (opp.kind === "update-existing") {
    const text = opp.reasons.join(" ").toLowerCase();
    if (text.includes("declined") || text.includes("decline")) {
      return {
        type: "search-decline",
        priority: opp.priority === "high" ? "high" : "medium",
        message: opp.reasons[0] ?? "Search performance decline",
      };
    }
    if (text.includes("ctr") || text.includes("title/meta")) {
      return {
        type: "ctr-review",
        priority: "medium",
        message: opp.reasons[0] ?? "CTR review candidate",
      };
    }
    if (text.includes("position")) {
      return {
        type: "position-opportunity",
        priority: "medium",
        message: opp.reasons[0] ?? "Position opportunity",
      };
    }
    return {
      type: "ctr-review",
      priority: "medium",
      message: opp.reasons[0] ?? "Search update candidate",
    };
  }

  return null;
}

function readinessToReasons(result: ArticleReadinessResult, isPublished: boolean): RefreshReason[] {
  const reasons: RefreshReason[] = [];
  for (const b of result.blockers) {
    if (b.id.includes("needs-verification")) {
      reasons.push({
        type: "content-verification-needed",
        priority: "high",
        message: b.message,
      });
    } else if (b.id.startsWith("links.broken")) {
      reasons.push({
        type: "broken-internal-link",
        priority: "high",
        message: b.message,
      });
    } else if (isPublished) {
      reasons.push({
        type: "readiness-warning",
        priority: "high",
        message: b.message,
      });
    }
  }
  for (const w of result.warnings) {
    if (w.id.startsWith("links.")) continue;
    reasons.push({
      type: "readiness-warning",
      priority: "low",
      message: w.message,
    });
  }
  return reasons;
}

export function buildRefreshQueue(input: {
  articles: ArticleV1[];
  readinessByArticle: Map<string, ArticleReadinessResult>;
  graph: ContentGraph;
  searchProfiles?: ArticleSearchProfile[];
  searchOpportunities?: SearchOpportunity[];
  gscAvailable?: boolean;
}): RefreshQueue {
  const { articles, readinessByArticle, graph, searchProfiles, searchOpportunities, gscAvailable } = input;
  const map = new Map<string, CandidateBuilder>();
  const overview = getGraphOverview(graph);
  const brokenLinks = findBrokenInternalLinks(graph);

  const eligible = articles.filter(
    (a) => a.publishing.status === "published" || a.publishing.status === "review",
  );

  for (const article of eligible) {
    const readiness = readinessByArticle.get(article.identity.id);
    if (readiness) {
      const builder = getOrCreate(map, article);
      const isPublished = article.publishing.status === "published";
      for (const reason of readinessToReasons(readiness, isPublished)) {
        addReason(builder, reason, {
          readiness: {
            blockers: readiness.blockers.map((c) => c.message),
            warnings: readiness.warnings.map((c) => c.message),
          },
        });
      }
    }
  }

  for (const broken of brokenLinks) {
    const article = articles.find((a) => a.identity.id === broken.sourceArticleId);
    if (!article || article.publishing.status !== "published") continue;
    const builder = getOrCreate(map, article);
    addReason(
      builder,
      {
        type: "broken-internal-link",
        priority: "high",
        message: `Broken link to /blog/${broken.targetSlug} (${broken.location})`,
      },
      {
        graph: {
          inboundLinks: 0,
          outboundLinks: 0,
          brokenLinks: [`/blog/${broken.targetSlug}`],
          backlinkOpportunityCount: 0,
        },
      },
    );
  }

  for (const orphan of overview.orphanCandidates) {
    const article = articles.find((a) => a.identity.id === orphan.id);
    if (!article) continue;
    const backlinks = findBacklinkOpportunities(orphan.id, graph);
    const builder = getOrCreate(map, article);
    const linkProfile = getArticleLinkProfile(orphan.id, graph);
    if (backlinks.length > 0) {
      addReason(
        builder,
        {
          type: "orphan-article",
          priority: "medium",
          message: `0 inbound links — ${backlinks.length} backlink opportunities available`,
        },
        {
          graph: {
            inboundLinks: linkProfile.inboundArticleIds.length,
            outboundLinks: linkProfile.outboundArticleIds.length,
            brokenLinks: [],
            backlinkOpportunityCount: backlinks.length,
          },
        },
      );
    } else {
      addReason(
        builder,
        {
          type: "orphan-article",
          priority: "low",
          message: "0 inbound internal links",
        },
        {
          graph: {
            inboundLinks: 0,
            outboundLinks: linkProfile.outboundArticleIds.length,
            brokenLinks: [],
            backlinkOpportunityCount: 0,
          },
        },
      );
    }
  }

  for (const deadEnd of overview.deadEndCandidates) {
    const article = articles.find((a) => a.identity.id === deadEnd.id);
    if (!article) continue;
    const builder = getOrCreate(map, article);
    if (!builder.reasons.some((r) => r.priority === "high" || r.priority === "medium")) {
      addReason(
        builder,
        {
          type: "dead-end-article",
          priority: "low",
          message: "0 outbound internal links",
        },
        {
          graph: {
            inboundLinks: getArticleLinkProfile(deadEnd.id, graph).inboundArticleIds.length,
            outboundLinks: 0,
            brokenLinks: [],
            backlinkOpportunityCount: 0,
          },
        },
      );
    }
  }

  if (searchOpportunities) {
    for (const opp of searchOpportunities) {
      if (!opp.articleId) continue;
      const article = articles.find((a) => a.identity.id === opp.articleId);
      if (!article) continue;
      if (article.publishing.status !== "published" && article.publishing.status !== "review") continue;

      const reason = classifySearchOpportunity(opp);
      if (!reason) continue;

      const builder = getOrCreate(map, article);
      const profile = searchProfiles?.find((p) => p.articleId === opp.articleId);
      addReason(builder, reason, {
        search: profile
          ? {
              clicks: profile.current.clicks,
              impressions: profile.current.impressions,
              ctr: profile.current.ctr,
              position: profile.current.position,
              previous: profile.previous,
              topQueries: profile.topQueries.slice(0, 5).map((q) => q.query),
            }
          : {
              clicks: opp.evidence.clicks,
              impressions: opp.evidence.impressions,
              ctr: opp.evidence.ctr,
              position: opp.evidence.position,
              previous: opp.previous,
            },
      });
    }
  }

  const candidates: RefreshCandidate[] = [...map.values()]
    .filter((b) => b.reasons.length > 0)
    .map((b) => ({
      articleId: b.articleId,
      title: b.title,
      slug: b.slug,
      type: b.type,
      category: b.category,
      status: b.status,
      priority: b.priority,
      reasons: b.reasons,
      suggestedActions: actionsForReasons(b.reasons),
      evidence: b.evidence,
    }))
    .sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      const ai = a.evidence.search?.impressions ?? 0;
      const bi = b.evidence.search?.impressions ?? 0;
      if (bi !== ai) return bi - ai;
      return a.title.localeCompare(b.title);
    });

  return {
    candidates,
    counts: {
      high: candidates.filter((c) => c.priority === "high").length,
      medium: candidates.filter((c) => c.priority === "medium").length,
      low: candidates.filter((c) => c.priority === "low").length,
      total: candidates.length,
    },
    gscAvailable: gscAvailable ?? false,
  };
}

export function getRefreshCandidate(
  articleId: string,
  queue: RefreshQueue,
): RefreshCandidate | undefined {
  return queue.candidates.find((c) => c.articleId === articleId);
}
