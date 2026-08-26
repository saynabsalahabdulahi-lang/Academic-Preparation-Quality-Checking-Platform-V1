import Link from "next/link";

import { requireAdminPage } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { AcademicManager } from "@/components/admin/academic-manager";

export default async function AdminPage() {
  await requireAdminPage();

  const universities = await prisma.university.findMany({
    orderBy: { name: "asc" },
    include: {
      colleges: {
        orderBy: { name: "asc" },
        include: {
          departments: {
            orderBy: { name: "asc" },
            include: {
              programs: {
                orderBy: { name: "asc" },
                include: {
                  guidelines: { select: { id: true, category: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-brand-600">
        ← Back to dashboard
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Universities &amp; guidelines</h1>
      <p className="mb-8 text-sm text-slate-500">
        Add a university, then its colleges, departments and programs. Set the
        writing rules on a program so uploaded documents are checked against
        them.
      </p>

      <AcademicManager
        universities={universities.map((u) => ({
          id: u.id,
          name: u.name,
          country: u.country,
          colleges: u.colleges.map((c) => ({
            id: c.id,
            name: c.name,
            departments: c.departments.map((d) => ({
              id: d.id,
              name: d.name,
              programs: d.programs.map((p) => ({
                id: p.id,
                name: p.name,
                degreeLevel: p.degreeLevel,
                guidelineCount: p.guidelines.length,
              })),
            })),
          })),
        }))}
      />
    </main>
  );
}
