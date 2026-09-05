import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { isAllowedAdminEmail, isAuthConfigured } from "@/lib/admin/auth-config";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Auth gate for /admin.
 * Do NOT redirect unauthenticated users to /admin/login here — the login page is
 * nested under this layout, and that redirect caused ERR_TOO_MANY_REDIRECTS.
 * Middleware already protects non-login /admin routes.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAuthConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-8">
        <div className="max-w-md rounded-lg border border-[var(--line)] bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-[var(--ink)]">Admin not configured</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Set AUTH_SECRET, ADMIN_PASSWORD_HASH, and ADMIN_EMAILS environment
            variables to enable Admin access. See .env.example.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();
  const allowed =
    Boolean(session?.user?.email) &&
    isAllowedAdminEmail(session!.user!.email!);

  if (!allowed) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
