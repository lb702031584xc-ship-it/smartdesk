"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CategoryBadge, SignalBadge } from "@/components/admin/AdminBadges";
import { productEditorialSignals } from "@/lib/admin/editorial-signals";
import {
  DEFAULT_PRODUCT_FILTERS,
  filterAdminProducts,
  filtersAreActive,
  type ProductListFilters,
} from "@/lib/admin/list-filters";
import {
  PRODUCT_AVAILABILITY,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/admin/editor-constants";
import type { ProductListItem } from "@/lib/admin/types";

const inputClass =
  "rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";

export function ProductListClient({ products }: { products: ProductListItem[] }) {
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT_PRODUCT_FILTERS);
  const visible = useMemo(() => filterAdminProducts(products, filters), [products, filters]);
  const active = filtersAreActive(filters, DEFAULT_PRODUCT_FILTERS);

  function update(patch: Partial<ProductListFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Search</span>
          <input
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Name, brand, id, subcategory"
            className={`${inputClass} w-64`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Category</span>
          <select
            value={filters.category}
            onChange={(event) => update({ category: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PRODUCT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Featured</span>
          <select
            value={filters.featured}
            onChange={(event) => update({ featured: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="yes">Featured</option>
            <option value="no">Not featured</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Availability</span>
          <select
            value={filters.availability}
            onChange={(event) => update({ availability: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {PRODUCT_AVAILABILITY.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Sort</span>
          <select
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value })}
            className={inputClass}
          >
            <option value="default">Default</option>
            <option value="name">Name</option>
            <option value="brand">Brand</option>
            <option value="category">Category</option>
            <option value="rating">Rating</option>
            <option value="lastChecked">Last checked</option>
          </select>
        </label>
        {active ? (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_PRODUCT_FILTERS)}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)]"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-[var(--muted)]">
        Showing {visible.length} of {products.length} products
      </p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          <p>No products match these filters.</p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_PRODUCT_FILTERS)}
            className="mt-3 rounded-md px-3 py-1.5 ring-1 ring-[var(--line)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--canvas)] text-xs uppercase tracking-wide text-[var(--subtle)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Subcategory</th>
                <th className="px-4 py-3 font-semibold">Rating</th>
                <th className="px-4 py-3 font-semibold">Availability</th>
                <th className="px-4 py-3 font-semibold">Featured</th>
                <th className="px-4 py-3 font-semibold">Last checked</th>
                <th className="px-4 py-3 font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs text-[var(--subtle)]">{product.id}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {productEditorialSignals(product).map((label) => (
                        <SignalBadge key={label} label={label} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{product.brand}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={product.category} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{product.subcategory ?? "—"}</td>
                  <td className="px-4 py-3">{product.rating ?? "—"}</td>
                  <td className="px-4 py-3">{product.availability ?? "—"}</td>
                  <td className="px-4 py-3">{product.featured ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{product.lastChecked ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
