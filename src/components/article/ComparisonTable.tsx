import type { ComparisonRow } from "@/types/article";

type ComparisonTableProps = {
  headers: string[];
  rows: ComparisonRow[];
  highlightIndex?: number;
  className?: string;
};

export function ComparisonTable({
  headers,
  rows,
  highlightIndex,
  className = "",
}: ComparisonTableProps) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-[var(--line)] ${className}`}>
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">Product comparison</caption>
        <thead className="bg-[var(--canvas)]">
          <tr>
            <th
              scope="col"
              className="sticky left-0 bg-[var(--canvas)] px-4 py-3 font-semibold text-[var(--ink)]"
            >
              Feature
            </th>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`px-4 py-3 font-semibold text-[var(--ink)] ${
                  highlightIndex === index ? "bg-[var(--ink)] text-white" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.feature}
              className={rowIndex % 2 === 0 ? "bg-[var(--paper)]" : "bg-[var(--canvas)]/60"}
            >
              <th
                scope="row"
                className="sticky left-0 bg-inherit px-4 py-3 font-medium text-[var(--ink)]"
              >
                {row.feature}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={`${row.feature}-${index}`}
                  className={`px-4 py-3 text-[var(--muted)] ${
                    highlightIndex === index ? "font-medium text-[var(--ink)]" : ""
                  }`}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
