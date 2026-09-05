import type { ReactNode } from "react";

type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  align = "left",
}: SectionHeadingProps) {
  const alignment =
    align === "center" ? "mx-auto text-center items-center" : "items-start";

  return (
    <div
      className={`mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between ${align === "center" ? "sm:flex-col sm:justify-center" : ""}`}
    >
      <div className={`flex max-w-2xl flex-col gap-3 ${alignment}`}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
