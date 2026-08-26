import { NextResponse } from "next/server";
import { RevisionAction } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createSectionRevision } from "@/lib/revisions/service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/ownership";
import {
  assertCredits,
  chargeCredits,
  InsufficientCreditsError,
} from "@/lib/credits/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_ACTIONS = new Set(Object.values(RevisionAction));
const REWRITE_CREDIT_COST = 1;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rl = rateLimit(`rewrite:${user.id}`, {
    limit: 40,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many rewrites. Please slow down." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const sectionId = body?.sectionId ? String(body.sectionId) : "";
  const action = String(body?.action ?? "");
  if (!sectionId || !VALID_ACTIONS.has(action as RevisionAction)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Confirm the section belongs to this document (defense in depth; the service
  // also verifies ownership).
  const section = await prisma.documentSection.findFirst({
    where: { id: sectionId, version: { documentId: id } },
    select: { id: true },
  });
  if (!section) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  let isAdmin = false;
  try {
    ({ isAdmin } = await assertCredits(user.id, REWRITE_CREDIT_COST));
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }

  try {
    const revision = await createSectionRevision({
      userId: user.id,
      isAdmin: user.role === "ADMIN",
      sectionId,
      action: action as RevisionAction,
      previousRevisionId: body?.previousRevisionId
        ? String(body.previousRevisionId)
        : undefined,
      styleGuidance: body?.styleGuidance ? String(body.styleGuidance) : undefined,
    });

    await chargeCredits({
      userId: user.id,
      action: "REWRITE",
      cost: REWRITE_CREDIT_COST,
      isAdmin,
      metadata: { documentId: id, revisionId: revision.id },
    });

    return NextResponse.json({ revision }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    console.error("Rewrite failed:", err);
    return NextResponse.json(
      { error: "Rewrite could not be completed. Please try again." },
      { status: 502 },
    );
  }
}
