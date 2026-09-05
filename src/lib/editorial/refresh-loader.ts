import { listArticlesV1, getArticleV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { buildContentGraph } from "@/lib/editorial/content-graph";
import { evaluateArticleReadiness } from "@/lib/editorial/article-readiness";
import { buildRefreshQueue, type RefreshQueue } from "@/lib/editorial/content-refresh";
import { isGSCConfigured } from "@/lib/search-console/client";
import { dateRangeForWindow } from "@/lib/search-console/normalize";
import type { SearchDateWindow } from "@/lib/search-console/types";

export async function loadRefreshQueueData(
  dateWindow: SearchDateWindow = 28,
  options?: { refreshSearch?: boolean },
): Promise<RefreshQueue> {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const bodies = new Map<string, string>();

  for (const a of articles) {
    const record = await getArticleV1(a.identity.id);
    bodies.set(a.identity.id, record?.body ?? "");
  }

  const knownSlugs = new Set(articles.map((a) => a.identity.slug));
  const graph = buildContentGraph(articles, bodies, products);

  const readinessByArticle = new Map<string, ReturnType<typeof evaluateArticleReadiness>>();
  const eligible = articles.filter(
    (a) => a.publishing.status === "published" || a.publishing.status === "review",
  );

  for (const article of eligible) {
    const body = bodies.get(article.identity.id) ?? "";
    readinessByArticle.set(
      article.identity.id,
      evaluateArticleReadiness(article, body, products, { knownSlugs }),
    );
  }

  let searchProfiles;
  let searchOpportunities;
  let gscAvailable = false;

  if (isGSCConfigured()) {
    try {
      const { fetchPageMetrics, fetchPageQueryMetrics, fetchQueryMetrics } =
        await import("@/lib/search-console/client");
      const { buildSearchIntelligence } = await import("@/lib/search-console/queries");
      if (options?.refreshSearch) {
        const { clearSearchConsoleCache } = await import("@/lib/search-console/cache");
        clearSearchConsoleCache();
      }
      const ranges = dateRangeForWindow(dateWindow);
      const bypass = options?.refreshSearch ?? false;
      const [currentPageRows, previousPageRows, pageQueryRows, queryRows] = await Promise.all([
        fetchPageMetrics(ranges.current.start, ranges.current.end, bypass),
        fetchPageMetrics(ranges.previous.start, ranges.previous.end, bypass),
        fetchPageQueryMetrics(ranges.current.start, ranges.current.end, bypass),
        fetchQueryMetrics(ranges.current.start, ranges.current.end, bypass),
      ]);
      const intelligence = buildSearchIntelligence(
        articles,
        currentPageRows,
        previousPageRows,
        pageQueryRows,
        queryRows,
        dateWindow,
        graph,
      );
      searchProfiles = intelligence.articles;
      searchOpportunities = intelligence.overview.opportunities;
      gscAvailable = true;
    } catch {
      gscAvailable = false;
    }
  }

  return buildRefreshQueue({
    articles,
    readinessByArticle,
    graph,
    searchProfiles,
    searchOpportunities,
    gscAvailable,
  });
}
