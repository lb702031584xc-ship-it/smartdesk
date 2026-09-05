import type { ReactNode } from "react";

type AdminSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AdminSection({ title, description, children }: AdminSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="mb-4 border-b border-[var(--line)] pb-3">
        <h2 className="text-lg font-semibold capitalize text-[var(--ink)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

type AdminBannerProps = {
  writeMode: "disabled" | "development" | "database";
};

export function AdminWriteBanner({ writeMode }: AdminBannerProps) {
  if (writeMode === "database") {
    return (
      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <strong>Durable database persistence.</strong> Authenticated admin saves write to the
        configured database (CONTENT_STORE=database).
      </div>
    );
  }

  if (writeMode === "development") {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Development write mode.</strong> Save API is enabled locally only
        (NODE_ENV=development). No authentication is configured — do not expose
        this environment publicly.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--muted)]">
      <strong>Read-only admin.</strong> Writes are disabled in production builds.
      JSON persistence is suitable for local development only; production requires
      a database or CMS behind authentication.
    </div>
  );
}
