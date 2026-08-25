import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Restore = make an earlier version the current one. History is preserved.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    select: { id: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // The version must belong to this document.
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId: id },
    select: { id: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found." }, { status: 404 });
  }

  await prisma.document.update({
    where: { id },
    data: { currentVersionId: versionId },
  });

  return NextResponse.json({ ok: true });
}
