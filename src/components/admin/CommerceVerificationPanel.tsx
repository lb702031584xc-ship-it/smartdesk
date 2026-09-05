"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  classifyAmazonUrlType,
  formatVerificationStateLabel,
  getCanonicalDateString,
  getCommerceVerificationDisplayState,
  suggestAmazonDetailUrl,
} from "@/lib/editorial/commerce-verification";
import {
  COMMERCE_STALE_DAYS,
  evaluateProductMaintenanceForProduct,
  extractAsinFromAmazonUrl,
  type ProductDependencyProfile,
} from "@/lib/editorial/product-maintenance";
import type { ProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";
import type { ProductAvailabilityV1, ProductV1Document } from "@/types/product-v1";
import { classifyAsinStatus } from "@/lib/commerce/asin";
import { AmazonCommerceAssistant } from "@/components/admin/AmazonCommerceAssistant";

const REASON_LABELS: Record<string, string> = {
  "missing-asin": "No ASIN",
  "search-url": "Search URL detected",
  "availability-unknown": "Availability unknown",
  "commerce-never-checked": "Never checked",
  "commerce-stale": "Commerce stale",
  "asin-url-mismatch": "ASIN/URL mismatch",
  "invalid-asin": "Invalid ASIN",
  "placeholder-asin": "Placeholder ASIN",
};

const URL_TYPE_LABELS = {
  detail: "Detail URL",
  search: "Search URL",
  other: "Other URL",
  missing: "Missing",
};

type CommerceVerificationPanelProps = {
  draft: ProductV1Document;
  dependencyProfile: ProductDependencyProfile;
  materialChangeContext?: ProductMaterialChangeContext;
  onMarkChecked: () => void;
  onUseSuggestion: (url: string) => void;
  onApplyCommerce: (patch: {
    asin?: string;
    amazonUrl?: string;
    availability?: ProductAvailabilityV1;
    primaryImage?: string;
  }) => void;
  onClearAsin: () => void;
};

export function CommerceVerificationPanel({
  draft,
  dependencyProfile,
  materialChangeContext,
  onMarkChecked,
  onUseSuggestion,
  onApplyCommerce,
  onClearAsin,
}: CommerceVerificationPanelProps) {
  const [copied, setCopied] = useState(false);
  const commerce = draft.commerce ?? {};
  const asinStatus = classifyAsinStatus(commerce.asin);
  const now = useMemo(() => new Date(), []);
  const verificationState = getCommerceVerificationDisplayState(commerce.lastChecked, { now });
  const urlType = classifyAmazonUrlType(commerce.amazonUrl);
  const urlAsin = commerce.amazonUrl ? extractAsinFromAmazonUrl(commerce.amazonUrl) : null;
  const suggestedUrl = suggestAmazonDetailUrl(commerce.asin, commerce.amazonUrl);

  const maintenanceCandidate = useMemo(
    () => evaluateProductMaintenanceForProduct(draft, dependencyProfile, { now }),
    [draft, dependencyProfile, now],
  );

  const commerceReasons =
    maintenanceCandidate?.reasons.filter((r) =>
      [
        "missing-asin",
        "search-url",
        "availability-unknown",
        "commerce-never-checked",
        "commerce-stale",
        "asin-url-mismatch",
        "invalid-asin",
        "placeholder-asin",
      ].includes(r.type),
    ) ?? [];

  const today = getCanonicalDateString(now);
  const alreadyCheckedToday = commerce.lastChecked?.trim() === today;

  async function copySuggestion() {
    if (!suggestedUrl) return;
    await navigator.clipboard.writeText(suggestedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMarkChecked() {
    if (alreadyCheckedToday) return;
    const confirmed = window.confirm(
      "Mark commerce checked today?\n\nUse this only after you have manually verified the commerce information (URL, ASIN, availability, price).",
    );
    if (!confirmed) return;
    onMarkChecked();
  }

  return (
    <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="mb-1 text-sm font-semibold">Commerce Verification</h3>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Verify commerce facts manually. Commerce becomes maintenance-stale after {COMMERCE_STALE_DAYS} days.
      </p>

      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">ASIN</dt>
          <dd>
            {commerce.asin?.trim() || "—"}
            {asinStatus === "placeholder" && (
              <span className="ml-2 text-xs font-medium text-red-700">(placeholder)</span>
            )}
            {asinStatus === "invalid" && (
              <span className="ml-2 text-xs text-red-700">(invalid format)</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">URL type</dt>
          <dd>{URL_TYPE_LABELS[urlType]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">Availability</dt>
          <dd>{commerce.availability ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">Verification</dt>
          <dd>{formatVerificationStateLabel(verificationState)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">Published Article refs</dt>
          <dd>{dependencyProfile.publishedRefs}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--muted)]">lastChecked</dt>
          <dd>{commerce.lastChecked?.trim() || "—"}</dd>
        </div>
      </dl>

      {asinStatus === "placeholder" && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-950">
          <p className="font-medium">Invalid / placeholder ASIN</p>
          <p className="text-xs">
            Remove it or replace it with a verified ASIN. Leaving the field empty is safer than storing a guessed value.
          </p>
          <button
            type="button"
            onClick={onClearAsin}
            className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Clear ASIN (local form)
          </button>
        </div>
      )}

      {asinStatus === "invalid" && commerce.asin?.trim() && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Stored ASIN appears invalid</p>
          <p className="text-xs">Edit manually in the Commerce section below, search Amazon if configured, or clear the field.</p>
          <button
            type="button"
            onClick={onClearAsin}
            className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100"
          >
            Clear ASIN (local form)
          </button>
        </div>
      )}

      <AmazonCommerceAssistant productId={draft.id} draft={draft} onApply={onApplyCommerce} />

      {urlAsin && commerce.asin?.trim() && urlAsin !== commerce.asin.trim().toUpperCase() && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">ASIN / URL mismatch</p>
          <p className="text-xs">Stored ASIN: {commerce.asin}</p>
          <p className="text-xs">URL ASIN: {urlAsin}</p>
        </div>
      )}

      {commerceReasons.length > 0 && (
        <ul className="mb-3 list-disc pl-5 text-sm text-amber-900">
          {commerceReasons.map((r) => (
            <li key={r.id}>{REASON_LABELS[r.type] ?? r.type}: {r.message}</li>
          ))}
        </ul>
      )}

      {suggestedUrl ? (
        <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="mb-1 font-medium text-blue-950">Suggested detail URL</p>
          <p className="mb-1 break-all font-mono text-xs text-blue-900">{suggestedUrl}</p>
          <p className="mb-2 text-xs text-blue-800">
            Suggested from stored ASIN — verify before saving. Affiliate tag is applied at runtime.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copySuggestion()}
              className="rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-medium hover:bg-blue-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => onUseSuggestion(suggestedUrl)}
              className="rounded-md bg-blue-800 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Use suggestion
            </button>
          </div>
        </div>
      ) : isSearchUrlWithoutAsin(commerce.amazonUrl, commerce.asin) ? (
        <p className="mb-3 text-xs text-[var(--muted)]">
          ASIN required before a detail URL can be suggested.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleMarkChecked}
          disabled={alreadyCheckedToday}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {alreadyCheckedToday ? "Commerce verified today" : "Mark commerce checked today"}
        </button>
        <p className="text-xs text-[var(--muted)]">
          Updates local form only — click Save changes to persist.
        </p>
      </div>

      {materialChangeContext?.available && (
        <MaterialChangeSection context={materialChangeContext} productId={draft.id} />
      )}
    </div>
  );
}

function isSearchUrlWithoutAsin(amazonUrl: string | undefined, asin: string | undefined): boolean {
  return classifyAmazonUrlType(amazonUrl) === "search" && !asin?.trim();
}

function MaterialChangeSection({
  context,
  productId,
}: {
  context: ProductMaterialChangeContext;
  productId: string;
}) {
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <h4 className="mb-1 text-sm font-semibold">Latest material Product change</h4>
      {context.changedAt && (
        <p className="mb-2 text-xs text-[var(--muted)]">
          From revision #{context.revisionNumber} · {new Date(context.changedAt).toLocaleString()}
          {context.changedBy ? ` · ${context.changedBy}` : ""}
        </p>
      )}
      <p className="mb-2 text-xs text-[var(--muted)]">Changed fields:</p>
      <ul className="mb-3 list-disc pl-5 text-sm">
        {context.materialFields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      {context.publishedArticles.length > 0 && (
        <>
          <p className="mb-1 text-xs font-medium text-[var(--muted)]">
            These Articles reference this Product and may need editorial review:
          </p>
          <div className="flex flex-wrap gap-2">
            {context.publishedArticles.map((a) => (
              <Link
                key={a.id}
                href={`/admin/articles/${a.id}?from=product-maintenance&productId=${productId}`}
                className="text-xs text-blue-700 hover:underline"
              >
                {a.title}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
