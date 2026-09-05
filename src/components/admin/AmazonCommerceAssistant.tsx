"use client";

import { useEffect, useState } from "react";
import {
  getAmazonCommerceProviderStatusAction,
  lookupAmazonProductByAsinAction,
  searchAmazonProductsAction,
} from "@/lib/admin/actions";
import {
  buildApplyAllPatch,
  buildCommerceApplyPatch,
  getApplicableCommerceFields,
} from "@/lib/commerce/apply";
import { classifyAsinStatus, normalizeAsin } from "@/lib/commerce/asin";
import type {
  CommerceApplyField,
  CommerceProviderStatus,
  CommerceSearchResultItem,
  CommerceSuggestion,
} from "@/lib/commerce/types";
import type { ProductV1Document, ProductAvailabilityV1 } from "@/types/product-v1";

const FIELD_LABELS: Record<CommerceApplyField, string> = {
  "commerce.asin": "ASIN",
  "commerce.amazonUrl": "Amazon URL",
  "commerce.availability": "Availability",
  "media.primary": "Primary image",
};

type AmazonCommerceAssistantProps = {
  productId: string;
  draft: ProductV1Document;
  onApply: (patch: {
    asin?: string;
    amazonUrl?: string;
    availability?: ProductAvailabilityV1;
    primaryImage?: string;
  }) => void;
};

export function AmazonCommerceAssistant({ productId, draft, onApply }: AmazonCommerceAssistantProps) {
  const commerce = draft.commerce ?? {};
  const media = draft.media ?? {};
  const asinState = classifyAsinStatus(commerce.asin);
  const [providerStatus, setProviderStatus] = useState<CommerceProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CommerceSuggestion | null>(null);
  const [searchResults, setSearchResults] = useState<CommerceSearchResultItem[] | null>(null);
  const [searchFetchedAt, setSearchFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await getAmazonCommerceProviderStatusAction();
      if ("error" in status) {
        setProviderStatus({ configured: false, source: null, message: status.error });
        return;
      }
      setProviderStatus(status);
    })();
  }, []);

  async function lookupByAsin(refresh = false) {
    const normalized = normalizeAsin(commerce.asin);
    if (!normalized.ok) {
      setError(normalized.message);
      return;
    }
    setLoading(true);
    setError(null);
    setSearchResults(null);
    const result = await lookupAmazonProductByAsinAction({
      productId,
      asin: normalized.asin,
      refresh,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (!result.ok) {
      setError(result.message);
      setSuggestion(null);
      return;
    }
    setSuggestion(result.suggestion);
  }

  async function searchAmazon() {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    const result = await searchAmazonProductsAction({
      productId,
      name: draft.identity.name,
      brand: draft.identity.brand,
      model: draft.identity.model,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (!result.ok) {
      setError(result.message);
      setSearchResults(null);
      return;
    }
    setSearchResults(result.items);
    setSearchFetchedAt(result.fetchedAt);
  }

  function selectSearchResult(item: CommerceSearchResultItem) {
    if (!searchFetchedAt) return;
    const confirmed = window.confirm(
      `Select this Amazon result?\n\nSmartDesk Product: ${draft.identity.name} (${draft.identity.brand})\nAmazon: ${item.title}\nASIN: ${item.asin}\n\nVerify this is the same product before applying.`,
    );
    if (!confirmed) return;
    setSuggestion({
      source: "amazon-paapi",
      fetchedAt: searchFetchedAt,
      asin: item.asin,
      amazonUrl: item.amazonUrl,
      primaryImage: item.primaryImage,
      sourceTitle: item.title,
    });
    setSearchResults(null);
  }

  function applyField(field: CommerceApplyField) {
    if (!suggestion) return;
    if (field === "commerce.asin" && suggestion.asin && commerce.asin?.trim() && suggestion.asin !== commerce.asin.trim().toUpperCase()) {
      const confirmed = window.confirm(
        `This will replace the current ASIN in the unsaved Product form.\n\nCurrent: ${commerce.asin}\nSuggested: ${suggestion.asin}\n\nNo database save until you click Save changes.`,
      );
      if (!confirmed) return;
    }
    const patch = buildCommerceApplyPatch(suggestion, [field]);
    onApply(patch);
  }

  function applyAllSafe() {
    if (!suggestion) return;
    if (
      suggestion.asin &&
      commerce.asin?.trim() &&
      suggestion.asin !== commerce.asin.trim().toUpperCase() &&
      !window.confirm(
        `Apply verified fields including ASIN replacement?\n\nCurrent ASIN: ${commerce.asin}\nSuggested ASIN: ${suggestion.asin}`,
      )
    ) {
      return;
    }
    const patch = buildApplyAllPatch(suggestion);
    onApply(patch);
  }

  const applicableFields = suggestion ? getApplicableCommerceFields(suggestion) : [];

  return (
    <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="mb-1 font-medium text-emerald-950">Amazon lookup</p>
      {!providerStatus ? (
        <p className="text-xs text-emerald-800">Checking provider…</p>
      ) : !providerStatus.configured ? (
        <p className="text-xs text-emerald-900">{providerStatus.message}</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-emerald-800">
            External Amazon data is a proposal until you Apply and Save. Lookup does not update lastChecked.
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            {asinState === "valid" ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void lookupByAsin(false)}
                className="rounded-md bg-emerald-800 px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Looking up…" : "Lookup Amazon by ASIN"}
              </button>
            ) : commerce.asin?.trim() ? (
              <p className="text-xs text-amber-900">
                {asinState === "placeholder"
                  ? "Placeholder ASIN — clear it or enter a verified ASIN before lookup."
                  : "Stored ASIN is invalid — clear it, edit manually, or search Amazon."}
              </p>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void searchAmazon()}
              className="rounded-md border border-emerald-400 bg-white px-3 py-1 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
            >
              Search Amazon
            </button>
            {suggestion && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void lookupByAsin(true)}
                className="rounded-md border border-emerald-400 bg-white px-3 py-1 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
              >
                Refresh
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="mb-2 text-xs text-red-800">{error}</p>}

      {searchResults && searchResults.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium text-emerald-950">Select a result:</p>
          {searchResults.map((item) => (
            <button
              key={item.asin}
              type="button"
              onClick={() => selectSearchResult(item)}
              className="block w-full rounded border border-emerald-200 bg-white p-2 text-left text-xs hover:bg-emerald-100"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-[var(--muted)]">ASIN: {item.asin}</p>
              {item.matchEvidence.length > 0 && (
                <p className="text-emerald-800">{item.matchEvidence.join(" · ")}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {searchResults && searchResults.length === 0 && (
        <p className="mb-2 text-xs text-emerald-900">No Amazon search results.</p>
      )}

      {suggestion && (
        <div className="space-y-3 border-t border-emerald-200 pt-3">
          <div className="rounded border border-emerald-100 bg-white p-2 text-xs">
            <p className="font-medium text-emerald-950">Current SmartDesk Product</p>
            <p>{draft.identity.name}</p>
            <p className="text-[var(--muted)]">{draft.identity.brand}{draft.identity.model ? ` · ${draft.identity.model}` : ""}</p>
          </div>
          <p className="text-xs text-emerald-800">
            Amazon data fetched at: {new Date(suggestion.fetchedAt).toLocaleString()}
          </p>
          {suggestion.sourceTitle && (
            <p className="text-xs">
              <span className="font-medium">Amazon title:</span> {suggestion.sourceTitle}
            </p>
          )}
          {suggestion.externalPrice && (
            <p className="text-xs text-[var(--muted)]">
              Amazon price (informational only): {suggestion.externalPrice} — not applied to priceRange.
            </p>
          )}

          <ComparisonRow
            label="ASIN"
            current={commerce.asin?.trim() || "—"}
            suggested={suggestion.asin}
            field="commerce.asin"
            onApply={applyField}
          />
          <ComparisonRow
            label="Amazon URL"
            current={commerce.amazonUrl?.trim() || "—"}
            suggested={suggestion.amazonUrl}
            field="commerce.amazonUrl"
            onApply={applyField}
          />
          <ComparisonRow
            label="Availability"
            current={commerce.availability ?? "—"}
            suggested={suggestion.availability}
            field="commerce.availability"
            onApply={applyField}
          />
          <ComparisonRow
            label="Primary image"
            current={media.primary?.trim() || "—"}
            suggested={suggestion.primaryImage}
            field="media.primary"
            onApply={applyField}
          />

          {applicableFields.length > 0 && (
            <button
              type="button"
              onClick={applyAllSafe}
              className="rounded-md border border-emerald-600 bg-white px-3 py-1 text-xs font-medium hover:bg-emerald-100"
            >
              Apply verified fields
            </button>
          )}
          <p className="text-xs text-[var(--muted)]">Apply updates local form only — Save changes to persist.</p>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  suggested,
  field,
  onApply,
}: {
  label: string;
  current: string;
  suggested?: string;
  field: CommerceApplyField;
  onApply: (field: CommerceApplyField) => void;
}) {
  if (!suggested || suggested === current) return null;
  return (
    <div className="rounded border border-emerald-100 bg-white p-2 text-xs">
      <p className="mb-1 font-medium">{label}</p>
      <p>
        <span className="text-[var(--muted)]">Current:</span> {current}
      </p>
      <p>
        <span className="text-emerald-800">Amazon suggestion:</span> {suggested}
      </p>
      <button
        type="button"
        onClick={() => onApply(field)}
        className="mt-1 rounded border border-emerald-400 px-2 py-0.5 text-xs hover:bg-emerald-50"
      >
        Apply {FIELD_LABELS[field]}
      </button>
    </div>
  );
}
