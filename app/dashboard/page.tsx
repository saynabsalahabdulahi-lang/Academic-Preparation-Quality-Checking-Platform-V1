import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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
        <button
          disabled
          title="Coming in the next phase"
          className="cursor-not-allowed rounded-lg bg-brand-600/60 px-5 py-2.5 font-medium text-white"
        >
          Upload document
        </button>
      </section>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
          No documents yet. Document upload arrives in Phase 3.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <span className="font-medium">{doc.title}</span>
              <span className="text-sm text-slate-500">{doc.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
