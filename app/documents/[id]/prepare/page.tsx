import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PreparePanel, type SectionData } from "./prepare-panel";

export default async function PreparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const document = await prisma.document.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    select: { id: true, title: true, currentVersionId: true },
  });
  if (!document?.currentVersionId) notFound();

  const version = await prisma.documentVersion.findUnique({
    where: { id: document.currentVersionId },
    include: {
      sections: { orderBy: { order: "asc" } },
      revisions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!version) notFound();

  // Latest revision per section.
  const latestBySection = new Map<string, (typeof version.revisions)[number]>();
  for (const r of version.revisions) {
    if (r.sectionId && !latestBySection.has(r.sectionId)) {
      latestBySection.set(r.sectionId, r);
    }
  }

  const sections: SectionData[] = version.sections
    .filter((s) => s.type !== "TABLE")
    .map((s) => {
      const rev = latestBySection.get(s.id);
      return {
        id: s.id,
        type: s.type,
        heading: s.heading,
        text: s.text,
        revision: rev
          ? {
              id: rev.id,
              revisedText: rev.revisedText,
              originalText: rev.originalText,
              whatChanged: rev.whatChanged,
              whyChanged: rev.whyChanged,
              confidence: rev.confidence,
              warnings: rev.warnings,
              status: rev.status,
              attempt: rev.attempt,
            }
          : null,
      };
    });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/documents/${id}`} className="text-sm text-brand-600">
        ← Back to document
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Preparation — {document.title}</h1>
      <p className="mb-8 text-sm text-slate-500">
        Revise your own writing section by section. Accept, reject, edit, or
        rewrite again, then create a new version when you&apos;re ready.
      </p>
      <PreparePanel documentId={id} sections={sections} />
    </main>
  );
}
