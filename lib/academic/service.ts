import type { DocumentCategory, Guideline } from "@prisma/client";

import { prisma } from "@/lib/db";

// Read-only queries for the University → College → Department → Program
// hierarchy used by the document upload selectors.

export function listUniversities() {
  return prisma.university.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: true },
  });
}

export function listColleges(universityId: string) {
  return prisma.college.findMany({
    where: { universityId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function listDepartments(collegeId: string) {
  return prisma.department.findMany({
    where: { collegeId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function listPrograms(departmentId: string) {
  return prisma.program.findMany({
    where: { departmentId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, degreeLevel: true },
  });
}

/**
 * Resolve the guideline that applies to a program + document category.
 * Prefers a category-specific guideline, then falls back to a program-wide one
 * (category = null). Returns null when the program has no guidelines.
 */
export async function resolveGuideline(
  programId: string,
  category: DocumentCategory,
): Promise<Guideline | null> {
  const specific = await prisma.guideline.findUnique({
    where: { programId_category: { programId, category } },
  });
  if (specific) return specific;

  return prisma.guideline.findFirst({
    where: { programId, category: null },
  });
}
