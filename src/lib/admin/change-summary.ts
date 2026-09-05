export type ChangeLine = {
  section: string;
  detail: string;
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function arrayDelta(label: string, before: unknown[] | undefined, after: unknown[] | undefined): string {
  const beforeLen = before?.length ?? 0;
  const afterLen = after?.length ?? 0;
  if (afterLen > beforeLen) return `${label}: ${afterLen - beforeLen} item added`;
  if (beforeLen > afterLen) return `${label}: ${beforeLen - afterLen} item removed`;
  return `${label} changed`;
}

export function summarizeRecordChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  sections: Array<{ section: string; pick: (value: Record<string, unknown>) => Record<string, unknown> }>,
): ChangeLine[] {
  const lines: ChangeLine[] = [];
  for (const { section, pick } of sections) {
    const left = pick(before);
    const right = pick(after);
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (same(left[key], right[key])) continue;
      if (Array.isArray(left[key]) || Array.isArray(right[key])) {
        lines.push({
          section,
          detail: arrayDelta(key, left[key] as unknown[] | undefined, right[key] as unknown[] | undefined),
        });
      } else {
        lines.push({ section, detail: key });
      }
    }
  }
  return lines;
}

export function productChangeSummary(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ChangeLine[] {
  return summarizeRecordChanges(before, after, [
    { section: "Identity", pick: (value) => (value.identity as Record<string, unknown>) ?? {} },
    { section: "Classification", pick: (value) => (value.classification as Record<string, unknown>) ?? {} },
    { section: "Editorial", pick: (value) => (value.editorial as Record<string, unknown>) ?? {} },
    { section: "Commerce", pick: (value) => (value.commerce as Record<string, unknown>) ?? {} },
    { section: "Media", pick: (value) => (value.media as Record<string, unknown>) ?? {} },
    { section: "Specs", pick: (value) => (value.specs as Record<string, unknown>) ?? {} },
    { section: "Review", pick: (value) => (value.review as Record<string, unknown>) ?? {} },
    { section: "Comparison", pick: (value) => (value.comparison as Record<string, unknown>) ?? {} },
    { section: "Relationships", pick: (value) => (value.relationships as Record<string, unknown>) ?? {} },
  ]);
}

export function articleChangeSummary(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ChangeLine[] {
  const lines = summarizeRecordChanges(before, after, [
    { section: "Identity", pick: (value) => (value.identity as Record<string, unknown>) ?? {} },
    { section: "Classification", pick: (value) => (value.classification as Record<string, unknown>) ?? {} },
    { section: "Editorial", pick: (value) => (value.editorial as Record<string, unknown>) ?? {} },
    { section: "SEO", pick: (value) => (value.seo as Record<string, unknown>) ?? {} },
    { section: "Commerce", pick: (value) => (value.commerce as Record<string, unknown>) ?? {} },
    { section: "Media", pick: (value) => (value.media as Record<string, unknown>) ?? {} },
    { section: "Publishing", pick: (value) => (value.publishing as Record<string, unknown>) ?? {} },
    { section: "Relationships", pick: (value) => (value.relationships as Record<string, unknown>) ?? {} },
    { section: "FAQ", pick: (value) => ({ faq: value.faq }) },
    { section: "Review", pick: (value) => (value.review as Record<string, unknown>) ?? {} },
    { section: "Comparison", pick: (value) => (value.comparison as Record<string, unknown>) ?? {} },
  ]);

  const beforeRefs = ((before.products as { primary?: Array<{ productId: string; rank?: number }> } | undefined)
    ?.primary ?? []);
  const afterRefs = ((after.products as { primary?: Array<{ productId: string; rank?: number }> } | undefined)
    ?.primary ?? []);
  if (!same(beforeRefs, afterRefs)) {
    const beforeById = new Map(beforeRefs.map((ref) => [ref.productId, ref]));
    for (const ref of afterRefs) {
      const previous = beforeById.get(ref.productId);
      if (previous && previous.rank !== ref.rank) {
        lines.push({
          section: "Products",
          detail: `rank changed for ${ref.productId}`,
        });
      }
    }
    if (beforeRefs.length !== afterRefs.length) {
      lines.push({
        section: "Products",
        detail: arrayDelta("products.primary", beforeRefs, afterRefs),
      });
    } else if (!lines.some((line) => line.section === "Products")) {
      lines.push({ section: "Products", detail: "products.primary changed" });
    }
  }

  return lines;
}

const PRODUCT_HIGH_RISK: Array<[string, (value: Record<string, unknown>) => unknown]> = [
  ["commerce.amazonUrl", (value) => (value.commerce as { amazonUrl?: string } | undefined)?.amazonUrl],
  ["asin", (value) => (value.commerce as { asin?: string } | undefined)?.asin],
  ["rating", (value) => (value.review as { rating?: number } | undefined)?.rating],
  ["featured", (value) => (value.editorial as { featured?: boolean } | undefined)?.featured],
  ["category", (value) => (value.identity as { category?: string } | undefined)?.category],
];

const ARTICLE_HIGH_RISK: Array<[string, (value: Record<string, unknown>) => unknown]> = [
  ["publishing.status", (value) => (value.publishing as { status?: string } | undefined)?.status],
  ["featured", (value) => (value.publishing as { featured?: boolean } | undefined)?.featured],
  ["comparison.winnerId", (value) => (value.comparison as { winnerId?: string } | undefined)?.winnerId],
  ["products.primary", (value) => (value.products as { primary?: unknown } | undefined)?.primary],
  ["seo.noindex", (value) => (value.seo as { noindex?: boolean } | undefined)?.noindex],
  ["seo.canonical", (value) => (value.seo as { canonical?: string } | undefined)?.canonical],
];

export function highRiskProductChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return PRODUCT_HIGH_RISK.filter(([, pick]) => !same(pick(before), pick(after))).map(([label]) => label);
}

export function highRiskArticleChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return ARTICLE_HIGH_RISK.filter(([, pick]) => !same(pick(before), pick(after))).map(([label]) => label);
}
