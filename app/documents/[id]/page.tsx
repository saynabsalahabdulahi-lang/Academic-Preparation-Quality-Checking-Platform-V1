import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/documents/categories";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // IDOR defense: constrain the query by owner. A different user's id simply
  // yields no result → 404, never another student's document.
  const document = await prisma.document.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          sections: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!document) notFound();

  const current =
    document.versions.find((v) => v.id === document.currentVersionId) ??
    document.versions[0];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-brand-600">
        ← Back to dashboard
      </Link>

      <header className="mb-8 mt-4">
        <h1 className="text-2xl font-bold">{document.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Badge>{CATEGORY_LABELS[document.category]}</Badge>
          <Badge>{document.status.replace(/_/g, " ")}</Badge>
          {current && (
            <Badge>Version {current.versionNumber}</Badge>
          )}
          {current?.processingStatus && (
            <Badge>{current.processingStatus.toLowerCase()}</Badge>
          )}
        </div>
      </header>

      {current?.processingStatus === "FAILED" && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not read this document.{" "}
          {current.processingError ?? ""}
        </p>
      )}

      {current?.processingError && current.processingStatus === "READY" && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Note: {current.processingError}
        </p>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Document structure ({current?.sections.length ?? 0} sections)
        </h2>
        {!current || current.sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            No content extracted yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {current.sections.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <span className="mb-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {s.type}
                </span>
                <p
                  className={
                    s.type === "HEADING"
                      ? "font-semibold"
                      : "text-slate-700 dark:text-slate-300"
                  }
                >
                  {s.text.length > 400 ? `${s.text.slice(0, 400)}…` : s.text}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="mt-10 text-sm text-slate-500">
        Analysis (the Academic Readiness report) arrives in Phase 6.
      </p>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
      {children}
    </span>
  );
}
