import type { ProductAvailabilityV1 } from "@/types/product-v1";

export type CommerceProviderSource = "amazon-paapi";

export type CommerceSuggestion = {
  source: CommerceProviderSource;
  fetchedAt: string;
  asin?: string;
  amazonUrl?: string;
  availability?: ProductAvailabilityV1;
  /** External price display — informational only; not mapped to priceRange by default. */
  externalPrice?: string;
  primaryImage?: string;
  sourceTitle?: string;
};

export type CommerceSearchResultItem = {
  asin: string;
  title: string;
  amazonUrl?: string;
  primaryImage?: string;
  matchEvidence: string[];
};

export type CommerceLookupErrorCode =
  | "not_configured"
  | "invalid_asin"
  | "not_found"
  | "permission_denied"
  | "rate_limited"
  | "network_error"
  | "malformed_response"
  | "provider_error";

export type CommerceLookupResult =
  | { ok: true; suggestion: CommerceSuggestion }
  | { ok: false; code: CommerceLookupErrorCode; message: string };

export type CommerceSearchResult =
  | { ok: true; items: CommerceSearchResultItem[]; fetchedAt: string }
  | { ok: false; code: CommerceLookupErrorCode; message: string };

export type CommerceProviderStatus = {
  configured: boolean;
  source: CommerceProviderSource | null;
  message: string;
};

export type CommerceApplyField =
  | "commerce.asin"
  | "commerce.amazonUrl"
  | "commerce.availability"
  | "media.primary";

export type CommerceApplyPatch = {
  asin?: string;
  amazonUrl?: string;
  availability?: ProductAvailabilityV1;
  primaryImage?: string;
};
