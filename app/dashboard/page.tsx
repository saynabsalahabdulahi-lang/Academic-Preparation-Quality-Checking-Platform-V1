import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/documents/categories";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const user = await requireUser();

  // Owner-scoped query — a student only ever sees their own documents.
  const documents = await prisma.document.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditBalance: true },
  });

  const admin = await isAdmin();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Academic Prepare
          </p>
          <h1 className="text-2xl font-bold">
            Welcome{user.name ? `, ${user.name}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            {account?.creditBalance ?? 0} credits
          </span>
          {admin && (
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      <section className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold">Your documents</h2>
          <p className="text-sm text-slate-500">
            Upload a Word (.docx) document to begin an analysis.
          </p>
        </div>
        <Link
          href="/documents/new"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700"
        >
          Upload document
        </Link>
      </section>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
          No documents yet. Click &ldquo;Upload document&rdquo; to get started.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span>
                  <span className="font-medium">{doc.title}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {CATEGORY_LABELS[doc.category]}
                  </span>
                </span>
                <span className="text-sm text-slate-500">
                  {doc.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
