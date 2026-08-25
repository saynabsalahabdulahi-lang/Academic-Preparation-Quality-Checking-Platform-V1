import type { NextAuthConfig } from "next-auth";

// Edge-safe configuration shared by middleware and the main auth instance.
// IMPORTANT: do not import Prisma, bcrypt, or other Node-only modules here —
// this file runs in the edge runtime via middleware.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    // Route protection for middleware. Returning false / a redirect blocks
    // access to protected paths for unauthenticated users.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/documents");
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
