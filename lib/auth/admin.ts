import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser, type SessionUser } from "@/lib/auth/session";

/**
 * Administrator resolution.
 *
 * The JWT session may still say STUDENT after a promotion, so the database is
 * the source of truth here. A fresh deployment has no administrator, so the
 * first registered account is promoted on first visit — that keeps the platform
 * manageable without direct database access, while later accounts can never
 * claim the role. Emails listed in ADMIN_EMAILS are always administrators.
 */
function allowListedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveAdmin(user: SessionUser): Promise<boolean> {
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  });
  if (!record) return false;
  if (record.role === "ADMIN") return true;

  if (allowListedEmails().includes(record.email.toLowerCase())) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    return true;
  }

  // Bootstrap: only when no administrator exists, and only for the very first
  // registered account.
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) return false;

  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firstUser?.id !== user.id) return false;

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  return true;
}

/** For pages: require an administrator, redirecting otherwise. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await resolveAdmin(user))) redirect("/dashboard");
  return { ...user, role: "ADMIN" };
}

/** True when the current user is (or becomes, on bootstrap) an administrator. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return resolveAdmin(user);
}

/** For route handlers: returns the admin user, or null when not permitted. */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return (await resolveAdmin(user)) ? { ...user, role: "ADMIN" } : null;
}
