import { normalizeAsin } from "./asin";
import { getAmazonPaapiConfig, isAmazonPaapiConfigured } from "./config";
import { lookupAmazonByAsin, searchAmazonProducts } from "./amazon-paapi";
import { userFacingProviderError } from "./normalize";
import type {
  CommerceLookupResult,
  CommerceProviderStatus,
  CommerceSearchResult,
  CommerceSuggestion,
} from "./types";

export type CommerceProvider = {
  status: () => CommerceProviderStatus;
  lookupByAsin: (asin: string, options?: { bypassCache?: boolean }) => Promise<CommerceLookupResult>;
  searchProducts: (query: {
    name: string;
    brand?: string;
    model?: string;
  }) => Promise<CommerceSearchResult>;
  suggestionFromSearchItem: (
    item: { asin: string; title: string; amazonUrl?: string; primaryImage?: string },
    fetchedAt: string,
  ) => CommerceSuggestion;
};

let providerOverride: CommerceProvider | null = null;

export function setCommerceProviderForTests(provider: CommerceProvider | null): void {
  providerOverride = provider;
}

function buildKeywords(query: { name: string; brand?: string; model?: string }): string {
  return [query.brand, query.name, query.model].filter(Boolean).join(" ").trim();
}

function createAmazonProvider(): CommerceProvider {
  return {
    status: () => ({
      configured: true,
      source: "amazon-paapi",
      message: "Amazon Product Advertising API is configured.",
    }),
    lookupByAsin: async (asin, options) => {
      const config = getAmazonPaapiConfig();
      if (!config) {
        return {
          ok: false,
          code: "not_configured",
          message: userFacingProviderError("not_configured"),
        };
      }
      const normalized = normalizeAsin(asin);
      if (!normalized.ok) {
        return {
          ok: false,
          code: "invalid_asin",
          message: normalized.message,
        };
      }
      return lookupAmazonByAsin(config, normalized.asin, options);
    },
    searchProducts: async (query) => {
      const config = getAmazonPaapiConfig();
      if (!config) {
        return {
          ok: false,
          code: "not_configured",
          message: userFacingProviderError("not_configured"),
        };
      }
      const keywords = buildKeywords(query);
      if (!keywords) {
        return {
          ok: false,
          code: "provider_error",
          message: "Product name is required for Amazon search.",
        };
      }
      return searchAmazonProducts(config, { keywords, ...query });
    },
    suggestionFromSearchItem: (item, fetchedAt) => ({
      source: "amazon-paapi",
      fetchedAt,
      asin: item.asin,
      amazonUrl: item.amazonUrl,
      primaryImage: item.primaryImage,
      sourceTitle: item.title,
    }),
  };
}

const unavailableProvider: CommerceProvider = {
  status: () => ({
    configured: false,
    source: null,
    message: "Amazon commerce provider is not configured.",
  }),
  lookupByAsin: async () => ({
    ok: false,
    code: "not_configured",
    message: userFacingProviderError("not_configured"),
  }),
  searchProducts: async () => ({
    ok: false,
    code: "not_configured",
    message: userFacingProviderError("not_configured"),
  }),
  suggestionFromSearchItem: (item, fetchedAt) => ({
    source: "amazon-paapi",
    fetchedAt,
    asin: item.asin,
    amazonUrl: item.amazonUrl,
    primaryImage: item.primaryImage,
    sourceTitle: item.title,
  }),
};

export function getCommerceProvider(): CommerceProvider {
  if (providerOverride) return providerOverride;
  if (isAmazonPaapiConfigured()) return createAmazonProvider();
  return unavailableProvider;
}

export function getCommerceProviderStatus(): CommerceProviderStatus {
  return getCommerceProvider().status();
}

export function isCommerceProviderConfigured(): boolean {
  return isAmazonPaapiConfigured();
}
