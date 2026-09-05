"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/AdminBadges";
import {
  ARTICLE_INTENTS,
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
} from "@/lib/admin/editor-constants";
import {
  DEFAULT_ARTICLE_FILTERS,
  filterAdminArticles,
  filtersAreActive,
  type ArticleListFilters,
} from "@/lib/admin/list-filters";
import type { ArticleListItem } from "@/lib/admin/types";

const inputClass =
  "rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";

export function ArticleListClient({ articles }: { articles: ArticleListItem[] }) {
  const [filters, setFilters] = useState<ArticleListFilters>(DEFAULT_ARTICLE_FILTERS);
  const visible = useMemo(() => filterAdminArticles(articles, filters), [articles, filters]);
  const active = filtersAreActive(filters, DEFAULT_ARTICLE_FILTERS);
  const categories = [...new Set(articles.map((article) => article.category).filter(Boolean))] as string[];

  function update(patch: Partial<ArticleListFilters>) {
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
            placeholder="Title, slug, id, category, keyword"
            className={`${inputClass} w-72`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Type</span>
          <select value={filters.type} onChange={(event) => update({ type: event.target.value })} className={inputClass}>
            <option value="">All</option>
            {ARTICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Status</span>
          <select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {ARTICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Category</span>
          <select
            value={filters.category}
            onChange={(event) => update({ category: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
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
          <span className="mb-1 block text-xs text-[var(--subtle)]">Intent</span>
          <select
            value={filters.intent}
            onChange={(event) => update({ intent: event.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {ARTICLE_INTENTS.map((intent) => (
              <option key={intent} value={intent}>
                {intent}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--subtle)]">Sort</span>
          <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })} className={inputClass}>
            <option value="default">Default</option>
            <option value="title">Title</option>
            <option value="updated">Updated</option>
            <option value="status">Status</option>
            <option value="type">Type</option>
          </select>
        </label>
        {active ? (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_ARTICLE_FILTERS)}
            className="rounded-md px-3 py-2 text-sm ring-1 ring-[var(--line)]"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-[var(--muted)]">
        Showing {visible.length} of {articles.length} articles
      </p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          <p>No articles match these filters.</p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_ARTICLE_FILTERS)}
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
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Intent</th>
                <th className="px-4 py-3 font-semibold">Featured</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((article) => (
                <tr key={article.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articles/${article.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {article.title}
                    </Link>
                    <p className="text-xs text-[var(--subtle)]">{article.slug}</p>
                  </td>
                  <td className="px-4 py-3">{article.type}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{article.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                    {article.status === "scheduled" && article.scheduledAt && (
                      <p className={`mt-0.5 text-xs ${new Date(article.scheduledAt).getTime() <= Date.now() ? "font-semibold text-amber-600" : "text-[var(--subtle)]"}`}>
                        {new Date(article.scheduledAt).getTime() <= Date.now() ? "Overdue · " : ""}
                        {new Date(article.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{article.intent}</td>
                  <td className="px-4 py-3">{article.featured ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{article.updatedAt ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articles/${article.id}`}
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
