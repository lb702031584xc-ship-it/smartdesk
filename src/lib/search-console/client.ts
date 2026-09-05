import type { GSCRow } from "./types";
import {
  getCachedRows,
  setCachedRows,
} from "./cache";

export function isGSCConfigured(): boolean {
  const property = process.env.GSC_PROPERTY?.trim();
  const email = process.env.GSC_CLIENT_EMAIL?.trim();
  const key = process.env.GSC_PRIVATE_KEY?.trim();
  return Boolean(property && email && key);
}

export function getGSCProperty(): string | undefined {
  return process.env.GSC_PROPERTY?.trim() || undefined;
}

function getPrivateKey(): string {
  const raw = process.env.GSC_PRIVATE_KEY?.trim() ?? "";
  return raw.replace(/\\n/g, "\n");
}

export type GSCFetchOptions = {
  startDate: string;
  endDate: string;
  dimensions: ("page" | "query" | "date")[];
  rowLimit?: number;
  bypassCache?: boolean;
};

export async function fetchGSCRows(options: GSCFetchOptions): Promise<GSCRow[]> {
  const property = getGSCProperty();
  if (!property) throw new Error("GSC_PROPERTY is not configured.");

  if (!options.bypassCache) {
    const cached = getCachedRows(
      property,
      options.startDate,
      options.endDate,
      options.dimensions,
    );
    if (cached) return cached.rows;
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GSC_CLIENT_EMAIL!.trim(),
      private_key: getPrivateKey(),
    },
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const response = await searchconsole.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions,
      rowLimit: options.rowLimit ?? 5000,
    },
  });

  const rows: GSCRow[] = (response.data.rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  setCachedRows(property, options.startDate, options.endDate, options.dimensions, rows);
  return rows;
}

export async function fetchPageMetrics(
  startDate: string,
  endDate: string,
  bypassCache?: boolean,
): Promise<GSCRow[]> {
  return fetchGSCRows({
    startDate,
    endDate,
    dimensions: ["page"],
    bypassCache,
  });
}

export async function fetchQueryMetrics(
  startDate: string,
  endDate: string,
  bypassCache?: boolean,
): Promise<GSCRow[]> {
  return fetchGSCRows({
    startDate,
    endDate,
    dimensions: ["query"],
    bypassCache,
  });
}

export async function fetchPageQueryMetrics(
  startDate: string,
  endDate: string,
  bypassCache?: boolean,
): Promise<GSCRow[]> {
  return fetchGSCRows({
    startDate,
    endDate,
    dimensions: ["page", "query"],
    bypassCache,
  });
}
