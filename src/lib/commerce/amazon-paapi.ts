import { createHmac, createHash } from "node:crypto";
import type { AmazonPaapiConfig } from "./config";
import {
  normalizePaapiItem,
  normalizePaapiSearchItem,
  userFacingProviderError,
} from "./normalize";
import type {
  CommerceLookupResult,
  CommerceSearchResult,
  CommerceSuggestion,
} from "./types";

const GET_ITEMS_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
const SEARCH_ITEMS_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";

const GET_ITEMS_RESOURCES = [
  "Images.Primary.Large",
  "ItemInfo.Title",
  "Offers.Listings.Availability",
  "Offers.Listings.Price",
  "DetailPageURL",
];

const SEARCH_RESOURCES = [
  "Images.Primary.Large",
  "ItemInfo.Title",
  "Offers.Listings.Price",
  "DetailPageURL",
];

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function signedPaapiRequest(
  config: AmazonPaapiConfig,
  target: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = JSON.stringify(body);
  const canonicalUri = target === GET_ITEMS_TARGET ? "/paapi5/getitems" : "/paapi5/searchitems";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${config.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = [
    "POST",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = getSignatureKey(config.secretKey, dateStamp, config.region, "ProductAdvertisingAPI");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return fetch(`https://${config.host}${canonicalUri}`, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": "application/json; charset=utf-8",
      host: config.host,
      "x-amz-date": amzDate,
      "x-amz-target": target,
      Authorization: authorization,
    },
    body: payload,
  });
}

function mapHttpError(status: number): CommerceLookupResult {
  if (status === 403) {
    return { ok: false, code: "permission_denied", message: userFacingProviderError("permission_denied") };
  }
  if (status === 429) {
    return { ok: false, code: "rate_limited", message: userFacingProviderError("rate_limited") };
  }
  return { ok: false, code: "provider_error", message: userFacingProviderError("provider_error") };
}

type CacheEntry = { expiresAt: number; suggestion: CommerceSuggestion };

const asinCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearAmazonPaapiCacheForTests(): void {
  asinCache.clear();
}

export async function lookupAmazonByAsin(
  config: AmazonPaapiConfig,
  asin: string,
  options?: { bypassCache?: boolean },
): Promise<CommerceLookupResult> {
  const cacheKey = `${config.marketplace}:${asin}`;
  if (!options?.bypassCache) {
    const cached = asinCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ok: true, suggestion: cached.suggestion };
    }
  }

  const fetchedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await signedPaapiRequest(config, GET_ITEMS_TARGET, {
      ItemIds: [asin],
      Resources: GET_ITEMS_RESOURCES,
      PartnerTag: config.partnerTag,
      PartnerType: "Associates",
      Marketplace: config.marketplace,
    });
  } catch {
    return { ok: false, code: "network_error", message: userFacingProviderError("network_error") };
  }

  if (!response.ok) {
    return mapHttpError(response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, code: "malformed_response", message: userFacingProviderError("malformed_response") };
  }

  const record = json as {
    ItemsResult?: { Items?: unknown[] };
    Errors?: Array<{ Code?: string; Message?: string }>;
  };

  if (record.Errors?.length) {
    const code = record.Errors[0]?.Code ?? "";
    if (code.includes("InvalidParameterValue") || code.includes("ItemNotFound")) {
      return { ok: false, code: "not_found", message: userFacingProviderError("not_found") };
    }
    if (code.includes("AccessDenied") || code.includes("Unauthorized")) {
      return { ok: false, code: "permission_denied", message: userFacingProviderError("permission_denied") };
    }
    return {
      ok: false,
      code: "provider_error",
      message: record.Errors[0]?.Message ?? userFacingProviderError("provider_error"),
    };
  }

  const item = record.ItemsResult?.Items?.[0] as Parameters<typeof normalizePaapiItem>[0] | undefined;
  const suggestion = item ? normalizePaapiItem(item, fetchedAt) : null;
  if (!suggestion) {
    return { ok: false, code: "not_found", message: userFacingProviderError("not_found") };
  }

  asinCache.set(cacheKey, { suggestion, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ok: true, suggestion };
}

export async function searchAmazonProducts(
  config: AmazonPaapiConfig,
  query: { keywords: string; name: string; brand?: string; model?: string },
): Promise<CommerceSearchResult> {
  const fetchedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await signedPaapiRequest(config, SEARCH_ITEMS_TARGET, {
      Keywords: query.keywords,
      ItemCount: 5,
      Resources: SEARCH_RESOURCES,
      PartnerTag: config.partnerTag,
      PartnerType: "Associates",
      Marketplace: config.marketplace,
    });
  } catch {
    return { ok: false, code: "network_error", message: userFacingProviderError("network_error") };
  }

  if (!response.ok) {
    const err = mapHttpError(response.status);
    if (!err.ok) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: "provider_error", message: userFacingProviderError("provider_error") };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, code: "malformed_response", message: userFacingProviderError("malformed_response") };
  }

  const record = json as {
    SearchResult?: { Items?: unknown[] };
    Errors?: Array<{ Code?: string; Message?: string }>;
  };

  if (record.Errors?.length) {
    const code = record.Errors[0]?.Code ?? "";
    if (code.includes("AccessDenied") || code.includes("Unauthorized")) {
      return { ok: false, code: "permission_denied", message: userFacingProviderError("permission_denied") };
    }
    return {
      ok: false,
      code: "provider_error",
      message: record.Errors[0]?.Message ?? userFacingProviderError("provider_error"),
    };
  }

  const items = (record.SearchResult?.Items ?? [])
    .map((item) =>
      normalizePaapiSearchItem(item as Parameters<typeof normalizePaapiSearchItem>[0], {
        name: query.name,
        brand: query.brand,
        model: query.model,
      }),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { ok: true, items, fetchedAt };
}
