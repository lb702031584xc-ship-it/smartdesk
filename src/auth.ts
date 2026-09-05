import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { isAllowedAdminEmail } from "@/lib/admin/auth-config";
import { normalizeEnvValue } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: normalizeEnvValue(process.env.AUTH_SECRET),
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        if (!isAllowedAdminEmail(email)) {
          return null;
        }

        const hash = normalizeEnvValue(process.env.ADMIN_PASSWORD_HASH);
        if (!hash) {
          return null;
        }

        const valid = await compare(password, hash);
        if (!valid) {
          return null;
        }

        return { id: email, email, name: "Admin" };
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      const isLoginPage = pathname === "/admin/login";
      const isProtected =
        pathname.startsWith("/admin") || pathname.startsWith("/dashboard");

      if (isLoginPage) return true;
      if (isProtected) return Boolean(session?.user);
      return true;
    },
  },
});
