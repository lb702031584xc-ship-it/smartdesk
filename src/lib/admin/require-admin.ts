import { auth } from "@/auth";
import { isAllowedAdminEmail } from "./auth-config";

export type AdminSession = {
  email: string;
};

/**
 * Server-side admin authorization check.
 * Returns the admin session or null if unauthorized.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!isAllowedAdminEmail(session.user.email)) return null;
  return { email: session.user.email };
}

/**
 * Throws if not an authorized admin. Use in server actions / route handlers.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: Admin access required.");
  }
  return session;
}
