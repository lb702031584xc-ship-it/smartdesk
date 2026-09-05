import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-[var(--ink)]">SmartDesk Admin</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">Sign in to manage content.</p>
        <LoginForm />
      </div>
    </div>
  );
}
