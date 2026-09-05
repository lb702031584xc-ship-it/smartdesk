import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
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

  if (!session?.user?.email || !isAllowedAdminEmail(session.user.email)) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
