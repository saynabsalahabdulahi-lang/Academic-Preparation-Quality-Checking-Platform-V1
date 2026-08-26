import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminPage } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { CATEGORY_OPTIONS } from "@/lib/documents/categories";
import { GuidelineEditor } from "@/components/admin/guideline-editor";

export default async function ProgramGuidelinesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage();

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      guidelines: { orderBy: { createdAt: "asc" } },
      department: {
        include: { college: { include: { university: true } } },
      },
    },
  });
  if (!program) notFound();

  const path = [
    program.department.college.university.name,
    program.department.college.name,
    program.department.name,
  ].join(" › ");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-brand-600">
        ← Back to universities
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">{program.name}</h1>
      <p className="mb-8 text-sm text-slate-500">{path}</p>

      <GuidelineEditor
        programId={program.id}
        categories={CATEGORY_OPTIONS}
        guidelines={program.guidelines.map((g) => ({
          id: g.id,
          category: g.category,
          citationStyle: g.citationStyle,
          referenceStyle: g.referenceStyle,
          fontFamily: g.fontFamily,
          fontSizePt: g.fontSizePt,
          lineSpacing: g.lineSpacing,
          marginsCm: g.marginsCm,
          minWords: g.minWords,
          maxWords: g.maxWords,
          requiredSections: g.requiredSections,
          prohibitedFormatting: g.prohibitedFormatting,
        }))}
      />
    </main>
  );
}
