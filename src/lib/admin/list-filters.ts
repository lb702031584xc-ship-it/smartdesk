import type { ArticleListItem, ProductListItem } from "./types";

function includesQuery(haystack: string | undefined, query: string): boolean {
  if (!query) return true;
  return (haystack ?? "").toLowerCase().includes(query.toLowerCase());
}

export type ProductListFilters = {
  query: string;
  category: string;
  featured: string;
  availability: string;
  sort: string;
};

export const DEFAULT_PRODUCT_FILTERS: ProductListFilters = {
  query: "",
  category: "",
  featured: "",
  availability: "",
  sort: "default",
};

export function filterAdminProducts(
  products: ProductListItem[],
  filters: ProductListFilters,
): ProductListItem[] {
  const filtered = products.filter((product) => {
    const queryHit =
      includesQuery(product.name, filters.query) ||
      includesQuery(product.brand, filters.query) ||
      includesQuery(product.id, filters.query) ||
      includesQuery(product.subcategory, filters.query);
    const categoryHit = !filters.category || product.category === filters.category;
    const featuredHit =
      !filters.featured ||
      (filters.featured === "yes" && product.featured) ||
      (filters.featured === "no" && !product.featured);
    const availabilityHit =
      !filters.availability || product.availability === filters.availability;
    return queryHit && categoryHit && featuredHit && availabilityHit;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "brand":
      sorted.sort((a, b) => a.brand.localeCompare(b.brand));
      break;
    case "category":
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      break;
    case "lastChecked":
      sorted.sort((a, b) => (b.lastChecked ?? "").localeCompare(a.lastChecked ?? ""));
      break;
    default:
      break;
  }
  return sorted;
}

export type ArticleListFilters = {
  query: string;
  type: string;
  status: string;
  category: string;
  featured: string;
  intent: string;
  sort: string;
};

export const DEFAULT_ARTICLE_FILTERS: ArticleListFilters = {
  query: "",
  type: "",
  status: "",
  category: "",
  featured: "",
  intent: "",
  sort: "default",
};

export function filterAdminArticles(
  articles: ArticleListItem[],
  filters: ArticleListFilters,
): ArticleListItem[] {
  const filtered = articles.filter((article) => {
    const queryHit =
      includesQuery(article.title, filters.query) ||
      includesQuery(article.slug, filters.query) ||
      includesQuery(article.id, filters.query) ||
      includesQuery(article.category, filters.query) ||
      includesQuery(article.primaryKeyword, filters.query);
    const typeHit = !filters.type || article.type === filters.type;
    const statusHit = !filters.status || article.status === filters.status;
    const categoryHit = !filters.category || article.category === filters.category;
    const featuredHit =
      !filters.featured ||
      (filters.featured === "yes" && article.featured) ||
      (filters.featured === "no" && !article.featured);
    const intentHit = !filters.intent || article.intent === filters.intent;
    return queryHit && typeHit && statusHit && categoryHit && featuredHit && intentHit;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "updated":
      sorted.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      break;
    case "status":
      sorted.sort((a, b) => a.status.localeCompare(b.status));
      break;
    case "type":
      sorted.sort((a, b) => a.type.localeCompare(b.type));
      break;
    default:
      break;
  }
  return sorted;
}

export function filtersAreActive(
  filters: Record<string, string>,
  defaults: Record<string, string>,
): boolean {
  return Object.keys(defaults).some((key) => (filters[key] ?? "") !== (defaults[key] ?? ""));
}
