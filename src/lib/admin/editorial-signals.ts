export function isAmazonSearchUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("amazon.")) return false;
    return (
      parsed.pathname === "/s" ||
      parsed.pathname.startsWith("/s/") ||
      parsed.searchParams.has("k") ||
      parsed.searchParams.has("field-keywords")
    );
  } catch {
    return /amazon\.[^/]+\/s\?/i.test(url);
  }
}

export function productEditorialSignals(product: {
  id: string;
  asin?: string;
  amazonUrl?: string;
  availability?: string;
  featured: boolean;
  hasGallery: boolean;
}): string[] {
  const badges: string[] = [];
  if (product.featured) badges.push("Featured");
  if (!product.asin) badges.push("No ASIN");
  if (isAmazonSearchUrl(product.amazonUrl)) badges.push("Search URL");
  if (product.availability === "unknown") badges.push("Availability unknown");
  if (!product.hasGallery) badges.push("No gallery");
  return badges;
}
