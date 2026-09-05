import type { ProductAvailabilityV1 } from "@/types/product-v1";
import type { CommerceSearchResultItem, CommerceSuggestion } from "./types";

/** Remove affiliate/partner query params — stored Product URLs stay untagged. */
export function stripAmazonAffiliateParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("tag");
    parsed.searchParams.delete("linkCode");
    parsed.searchParams.delete("linkId");
    parsed.searchParams.delete("ref");
    parsed.searchParams.delete("ref_");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildUntaggedDetailUrl(asin: string, marketplaceHost = "www.amazon.com"): string {
  return `https://${marketplaceHost}/dp/${asin.toUpperCase()}`;
}

export function mapPaapiAvailability(value: string | undefined): ProductAvailabilityV1 | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("now") || normalized.includes("instock") || normalized.includes("in stock")) {
    return "active";
  }
  if (
    normalized.includes("outofstock") ||
    normalized.includes("out of stock") ||
    normalized.includes("unavailable")
  ) {
    return "inactive";
  }
  return undefined;
}

type PaapiItem = {
  ASIN?: string;
  DetailPageURL?: string;
  Images?: {
    Primary?: {
      Large?: { URL?: string };
      Medium?: { URL?: string };
    };
  };
  ItemInfo?: {
    Title?: { DisplayValue?: string };
    ByLineInfo?: { Brand?: { DisplayValue?: string } };
  };
  Offers?: {
    Listings?: Array<{
      Availability?: { Message?: string; Type?: string };
      Price?: { DisplayAmount?: string; Amount?: number; Currency?: string };
    }>;
  };
};

export function normalizePaapiItem(item: PaapiItem, fetchedAt: string): CommerceSuggestion | null {
  const asin = item.ASIN?.trim().toUpperCase();
  if (!asin) return null;

  const listing = item.Offers?.Listings?.[0];
  const availabilityRaw = listing?.Availability?.Type ?? listing?.Availability?.Message;
  const availability = mapPaapiAvailability(availabilityRaw);

  let amazonUrl = item.DetailPageURL?.trim();
  if (amazonUrl) {
    amazonUrl = stripAmazonAffiliateParams(amazonUrl);
  } else {
    amazonUrl = buildUntaggedDetailUrl(asin);
  }

  const primaryImage =
    item.Images?.Primary?.Large?.URL?.trim() ||
    item.Images?.Primary?.Medium?.URL?.trim() ||
    undefined;

  const externalPrice = listing?.Price?.DisplayAmount?.trim();

  return {
    source: "amazon-paapi",
    fetchedAt,
    asin,
    amazonUrl,
    availability,
    externalPrice,
    primaryImage,
    sourceTitle: item.ItemInfo?.Title?.DisplayValue?.trim(),
  };
}

export function normalizePaapiSearchItem(
  item: PaapiItem,
  query: { name: string; brand?: string; model?: string },
): CommerceSearchResultItem | null {
  const asin = item.ASIN?.trim().toUpperCase();
  const title = item.ItemInfo?.Title?.DisplayValue?.trim();
  if (!asin || !title) return null;

  const evidence: string[] = [];
  const titleLower = title.toLowerCase();
  if (query.brand?.trim() && titleLower.includes(query.brand.trim().toLowerCase())) {
    evidence.push("Brand matches title");
  }
  const nameTokens = query.name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const overlap = nameTokens.filter((t) => titleLower.includes(t));
  if (overlap.length > 0) {
    evidence.push(`Name token overlap: ${overlap.slice(0, 3).join(", ")}`);
  }
  if (query.model?.trim() && titleLower.includes(query.model.trim().toLowerCase())) {
    evidence.push("Model matches title");
  }

  let amazonUrl = item.DetailPageURL?.trim();
  if (amazonUrl) amazonUrl = stripAmazonAffiliateParams(amazonUrl);

  return {
    asin,
    title,
    amazonUrl,
    primaryImage:
      item.Images?.Primary?.Large?.URL?.trim() ||
      item.Images?.Primary?.Medium?.URL?.trim(),
    matchEvidence: evidence,
  };
}

export function userFacingProviderError(code: string): string {
  switch (code) {
    case "not_configured":
      return "Amazon lookup is not configured.";
    case "invalid_asin":
      return "ASIN is invalid — fix or search Amazon manually.";
    case "not_found":
      return "No Amazon item found for this ASIN.";
    case "permission_denied":
      return "Amazon API permission denied — check PAAPI credentials and account eligibility.";
    case "rate_limited":
      return "Amazon API rate limit reached — try again later.";
    case "network_error":
      return "Network error contacting Amazon API.";
    case "malformed_response":
      return "Amazon API returned an unexpected response.";
    default:
      return "Amazon lookup failed.";
  }
}
