import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createRevisedVersion } from "@/lib/documents/versioning";

export const runtime = "nodejs";

// Create a new version by applying accepted/edited revisions to the current one.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  try {
    const version = await createRevisedVersion(id);
    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create a new version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
