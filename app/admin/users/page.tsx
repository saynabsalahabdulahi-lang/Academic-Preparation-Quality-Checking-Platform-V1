import Link from "next/link";

import { requireAdminPage } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { UserCredits } from "@/components/admin/user-credits";

export default async function AdminUsersPage() {
  await requireAdminPage();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      creditBalance: true,
      _count: { select: { documents: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-brand-600">
        ← Back to admin
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Students &amp; credits</h1>
      <p className="mb-8 text-sm text-slate-500">
        Each upload, analysis and rewrite uses one credit. Administrators are
        never charged.
      </p>

      <UserCredits
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          creditBalance: u.creditBalance,
          documentCount: u._count.documents,
        }))}
      />
    </main>
  );
}
