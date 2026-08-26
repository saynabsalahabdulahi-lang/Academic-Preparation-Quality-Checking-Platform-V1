import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  level: z.enum(["university", "college", "department", "program"]),
  name: z.string().trim().min(1, "A name is required").max(200),
  parentId: z.string().trim().optional(),
  country: z.string().trim().max(100).optional(),
  degreeLevel: z.string().trim().max(60).optional(),
});

const deleteSchema = z.object({
  level: z.enum(["university", "college", "department", "program"]),
  id: z.string().trim().min(1),
});

function requiresParent(level: string): boolean {
  return level !== "university";
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Administrators only." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { level, name, parentId, country, degreeLevel } = parsed.data;
  if (requiresParent(level) && !parentId) {
    return NextResponse.json(
      { error: "A parent must be selected." },
      { status: 400 },
    );
  }

  try {
    switch (level) {
      case "university":
        return NextResponse.json(
          {
            item: await prisma.university.create({
              data: { name, country: country || null },
            }),
          },
          { status: 201 },
        );
      case "college":
        return NextResponse.json(
          {
            item: await prisma.college.create({
              data: { name, universityId: parentId! },
            }),
          },
          { status: 201 },
        );
      case "department":
        return NextResponse.json(
          {
            item: await prisma.department.create({
              data: { name, collegeId: parentId! },
            }),
          },
          { status: 201 },
        );
      case "program":
        return NextResponse.json(
          {
            item: await prisma.program.create({
              data: {
                name,
                departmentId: parentId!,
                degreeLevel: degreeLevel || null,
              },
            }),
          },
          { status: 201 },
        );
    }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That name already exists here." },
        { status: 409 },
      );
    }
    console.error("Admin academic create failed:", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Administrators only." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = deleteSchema.safeParse({
    level: searchParams.get("level"),
    id: searchParams.get("id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { level, id } = parsed.data;
  try {
    if (level === "university") await prisma.university.delete({ where: { id } });
    else if (level === "college") await prisma.college.delete({ where: { id } });
    else if (level === "department")
      await prisma.department.delete({ where: { id } });
    else await prisma.program.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin academic delete failed:", err);
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
