type RatingBoxProps = {
  rating: number;
  label?: string;
  categories?: Array<{ label: string; score: number }>;
  className?: string;
};

function clampRating(value: number) {
  return Math.max(0, Math.min(5, value));
}

export function RatingBox({
  rating,
  label = "Our rating",
  categories = [],
  className = "",
}: RatingBoxProps) {
  const score = clampRating(rating);

  return (
    <aside
      className={`rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6 ${className}`}
      aria-label={label}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
        {label}
      </p>
      <div className="mt-3 flex items-end gap-2">
        <p className="font-[family-name:var(--font-display)] text-5xl font-medium tracking-tight text-[var(--ink)]">
          {score.toFixed(1)}
        </p>
        <p className="mb-1 text-sm text-[var(--muted)]">/ 5</p>
      </div>
      <div
        className="mt-3 flex gap-1"
        role="img"
        aria-label={`${score.toFixed(1)} out of 5 stars`}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const filled = score >= index + 1;
          const half = !filled && score > index && score < index + 1;
          return (
            <span
              key={index}
              className={`text-lg ${filled || half ? "text-[var(--ink)]" : "text-[var(--line-strong)]"}`}
              aria-hidden
            >
              {filled ? "★" : half ? "☆" : "☆"}
            </span>
          );
        })}
      </div>

      {categories.length > 0 ? (
        <ul className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
          {categories.map((category) => (
            <li key={category.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">{category.label}</span>
                <span className="font-medium text-[var(--ink)]">
                  {clampRating(category.score).toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                <div
                  className="h-full rounded-full bg-[var(--ink)] transition-all"
                  style={{ width: `${(clampRating(category.score) / 5) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
