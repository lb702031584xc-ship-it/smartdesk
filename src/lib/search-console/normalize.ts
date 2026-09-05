import { siteConfig } from "@/lib/site";

export function getSiteHost(): string {
  try {
    return new URL(siteConfig.url).hostname.replace(/^www\./, "");
  } catch {
    return "smartdesksetup.com";
  }
}

export function normalizeGscPageUrl(url: string, siteHost?: string): string | null {
  const expectedHost = (siteHost ?? getSiteHost()).replace(/^www\./, "");
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== expectedHost) return null;
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path;
  } catch {
    return null;
  }
}

const BLOG_SLUG_RE = /^\/blog\/([a-z0-9][a-z0-9-]*[a-z0-9])$/;

export function mapPathToArticleSlug(path: string): string | null {
  const match = path.match(BLOG_SLUG_RE);
  return match ? match[1] : null;
}

export function mapGscPageToSlug(
  pageUrl: string,
  siteHost?: string,
): { path: string; slug: string | null } | null {
  const path = normalizeGscPageUrl(pageUrl, siteHost);
  if (!path) return null;
  return { path, slug: mapPathToArticleSlug(path) };
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateRangeForWindow(days: number): {
  current: { start: string; end: string };
  previous: { start: string; end: string };
} {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const currentStart = new Date(end);
  currentStart.setDate(currentStart.getDate() - days + 1);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return {
    current: { start: formatDate(currentStart), end: formatDate(end) },
    previous: { start: formatDate(previousStart), end: formatDate(previousEnd) },
  };
}

export function safePercentChange(current: number, previous: number): number | undefined {
  if (previous < 10) return undefined;
  return ((current - previous) / previous) * 100;
}

export function aggregateRows(
  rows: { clicks: number; impressions: number; ctr: number; position: number }[],
): { clicks: number; impressions: number; ctr: number; position: number } {
  if (rows.length === 0) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position =
    impressions > 0
      ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
      : 0;
  return { clicks, impressions, ctr, position };
}
