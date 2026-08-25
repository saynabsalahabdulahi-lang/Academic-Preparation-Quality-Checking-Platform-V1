import { NextResponse } from "next/server";
import { RevisionStatus } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/session";
import {
  updateRevisionStatus,
  RevisionError,
} from "@/lib/revisions/service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/ownership";

export const runtime = "nodejs";

// Only student-driven decisions are allowed here.
const ALLOWED = new Set<RevisionStatus>(["ACCEPTED", "REJECTED", "EDITED"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "") as RevisionStatus;
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const revision = await updateRevisionStatus({
      userId: user.id,
      isAdmin: user.role === "ADMIN",
      revisionId: id,
      status,
      editedText: body?.editedText ? String(body.editedText) : undefined,
    });
    return NextResponse.json({ revision });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (err instanceof RevisionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Revision update failed:", err);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
