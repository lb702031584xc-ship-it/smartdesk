import { isAmazonSearchUrl } from "@/lib/admin/editorial-signals";
import { classifyAsinStatus, type AsinCatalogStatus } from "@/lib/commerce/asin";
import { classifyAmazonUrlType, type AmazonUrlType } from "@/lib/editorial/commerce-verification";
import { extractAsinFromAmazonUrl } from "@/lib/editorial/product-maintenance";
import { isCommerceProviderConfigured } from "@/lib/commerce/provider";
import type { ProductV1Document } from "@/types/product-v1";

export type ProductCommerceAuditRow = {
  productId: string;
  name: string;
  brand: string;
  model?: string;
  amazonUrl?: string;
  urlType: AmazonUrlType;
  storedAsin?: string;
  asinStatus: AsinCatalogStatus;
  lastChecked?: string;
  availability?: string;
  publishedRefs: number;
  totalRefs: number;
  asinUrlMismatch: boolean;
  detailUrlSuggestionAvailable: boolean;
  amazonLookupAvailable: boolean;
  readyForAmazonLookup: boolean;
};

export type CatalogCommerceAudit = {
  productCount: number;
  validAsin: number;
  invalidAsin: number;
  placeholderAsin: number;
  missingAsin: number;
  searchUrls: number;
  detailUrls: number;
  asinUrlMismatches: number;
  searchUrlValidAsin: number;
  searchUrlInvalidAsin: number;
  searchUrlMissingAsin: number;
  searchUrlPlaceholderAsin: number;
  readyForAmazonLookup: number;
  products: ProductCommerceAuditRow[];
  integrity: {
    placeholderAsinFail: boolean;
    invalidAsinFail: boolean;
    asinMismatchFail: boolean;
  };
};

export function auditProductCommerce(
  product: ProductV1Document,
  refs: { publishedRefs: number; totalRefs: number },
): ProductCommerceAuditRow {
  const commerce = product.commerce ?? {};
  const asinStatus = classifyAsinStatus(commerce.asin);
  const urlType = classifyAmazonUrlType(commerce.amazonUrl);
  const urlAsin =
    commerce.amazonUrl && urlType === "detail"
      ? extractAsinFromAmazonUrl(commerce.amazonUrl)
      : null;
  const asinUrlMismatch = Boolean(
    asinStatus === "valid" &&
      commerce.asin?.trim() &&
      urlAsin &&
      urlAsin !== commerce.asin.trim().toUpperCase(),
  );
  const detailUrlSuggestionAvailable =
    asinStatus === "valid" && isAmazonSearchUrl(commerce.amazonUrl);
  const amazonLookupAvailable =
    isCommerceProviderConfigured() && asinStatus === "valid";
  const readyForAmazonLookup =
    isCommerceProviderConfigured() &&
    (asinStatus === "valid" || asinStatus === "missing" || asinStatus === "invalid");

  return {
    productId: product.id,
    name: product.identity.name,
    brand: product.identity.brand,
    model: product.identity.model,
    amazonUrl: commerce.amazonUrl,
    urlType,
    storedAsin: commerce.asin?.trim() || undefined,
    asinStatus,
    lastChecked: commerce.lastChecked,
    availability: commerce.availability,
    publishedRefs: refs.publishedRefs,
    totalRefs: refs.totalRefs,
    asinUrlMismatch,
    detailUrlSuggestionAvailable,
    amazonLookupAvailable,
    readyForAmazonLookup,
  };
}

export function summarizeCatalogCommerceAudit(rows: ProductCommerceAuditRow[]): CatalogCommerceAudit {
  let validAsin = 0;
  let invalidAsin = 0;
  let placeholderAsin = 0;
  let missingAsin = 0;
  let searchUrls = 0;
  let detailUrls = 0;
  let asinUrlMismatches = 0;
  let searchUrlValidAsin = 0;
  let searchUrlInvalidAsin = 0;
  let searchUrlMissingAsin = 0;
  let searchUrlPlaceholderAsin = 0;
  let readyForAmazonLookup = 0;

  for (const row of rows) {
    if (row.asinStatus === "valid") validAsin++;
    else if (row.asinStatus === "invalid") invalidAsin++;
    else if (row.asinStatus === "placeholder") placeholderAsin++;
    else missingAsin++;

    if (row.urlType === "search") {
      searchUrls++;
      if (row.asinStatus === "valid") searchUrlValidAsin++;
      else if (row.asinStatus === "invalid") searchUrlInvalidAsin++;
      else if (row.asinStatus === "placeholder") searchUrlPlaceholderAsin++;
      else searchUrlMissingAsin++;
    }
    if (row.urlType === "detail") detailUrls++;
    if (row.asinUrlMismatch) asinUrlMismatches++;
    if (row.readyForAmazonLookup) readyForAmazonLookup++;
  }

  return {
    productCount: rows.length,
    validAsin,
    invalidAsin,
    placeholderAsin,
    missingAsin,
    searchUrls,
    detailUrls,
    asinUrlMismatches,
    searchUrlValidAsin,
    searchUrlInvalidAsin,
    searchUrlMissingAsin,
    searchUrlPlaceholderAsin,
    readyForAmazonLookup,
    products: rows,
    integrity: {
      placeholderAsinFail: placeholderAsin > 0,
      invalidAsinFail: invalidAsin > 0,
      asinMismatchFail: asinUrlMismatches > 0,
    },
  };
}

/** Deterministic triage priority — lower sorts first. */
export function catalogCommerceTriageOrder(row: ProductCommerceAuditRow): number {
  if (row.asinStatus === "placeholder") return 0;
  if (row.asinUrlMismatch) return 1;
  if (row.detailUrlSuggestionAvailable) return 2;
  if (row.asinStatus === "missing" && row.publishedRefs >= 3) return 3;
  if (row.asinStatus === "missing") return 4;
  if (row.asinStatus === "invalid") return 5;
  return 6;
}
