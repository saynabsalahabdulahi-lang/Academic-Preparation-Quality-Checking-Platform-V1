import { NextResponse } from "next/server";
import { z } from "zod";
import { DocumentCategory } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

// An empty string from a form field means "not specified".
const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null));

const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const lines = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const guidelineSchema = z.object({
  programId: z.string().trim().min(1),
  category: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || Object.keys(DocumentCategory).includes(v),
      "Unknown document type.",
    ),
  citationStyle: optionalText,
  referenceStyle: optionalText,
  fontFamily: optionalText,
  fontSizePt: optionalNumber,
  lineSpacing: optionalNumber,
  marginsCm: optionalNumber,
  minWords: optionalNumber,
  maxWords: optionalNumber,
  requiredSections: lines,
  prohibitedFormatting: lines,
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Administrators only." }, { status: 403 });
  }

  const parsed = guidelineSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { programId, category, ...rest } = parsed.data;

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const data = {
    ...rest,
    minWords: rest.minWords === null ? null : Math.round(rest.minWords),
    maxWords: rest.maxWords === null ? null : Math.round(rest.maxWords),
  };

  try {
    // A null category means "applies to every document type". Prisma cannot
    // target a null value through the compound unique key, so look it up first.
    const existing = await prisma.guideline.findFirst({
      where: { programId, category: category as DocumentCategory | null },
      select: { id: true },
    });

    const guideline = existing
      ? await prisma.guideline.update({ where: { id: existing.id }, data })
      : await prisma.guideline.create({
          data: {
            programId,
            category: category as DocumentCategory | null,
            ...data,
          },
        });

    return NextResponse.json({ guideline }, { status: 201 });
  } catch (err) {
    console.error("Guideline save failed:", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
