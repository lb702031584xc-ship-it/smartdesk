export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  rating: number;
  priceRange: string;
  pros: string[];
  cons: string[];
  amazonUrl: string;
  description?: string;
  bestFor?: string;
  featured?: boolean;
  asin?: string;
  updatedAt?: string;
  verdict?: string;
  notFor?: string[];
  specs?: Record<string, string | number | boolean>;
  reviewSlug?: string;
  alternatives?: string[];
  images?: string[];
};

/** Article-level overrides merged onto a catalog product. */
export type ProductRef = {
  id: string;
  rank?: number;
  badge?: string;
  summary?: string;
  verdict?: string;
  bestFor?: string;
};

/** Product ready for article UI components. */
export type ResolvedProduct = Product & {
  rank?: number;
  badge?: string;
  summary?: string;
  verdict?: string;
  /** Display alias for priceRange (keeps older UI props stable). */
  priceLabel: string;
};
