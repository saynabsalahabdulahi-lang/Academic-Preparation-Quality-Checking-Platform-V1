import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { analyzeDocumentVersion, AnalysisError } from "@/lib/analysis/service";
import {
  assertCredits,
  chargeCredits,
  CREDIT_COSTS,
  InsufficientCreditsError,
} from "@/lib/credits/service";

export const runtime = "nodejs";
// Analysis can take longer than the default; request the max we can.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Owner-scoped fetch (IDOR defense) — a non-owner sees a 404.
  const document = await prisma.document.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    select: { id: true, currentVersionId: true },
  });
  if (!document?.currentVersionId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const rl = rateLimit(`analyze:${user.id}`, {
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many analyses. Please try again shortly." },
      { status: 429 },
    );
  }

  // Server-side credit check (administrators are not metered).
  let metered = false;
  try {
    ({ metered } = await assertCredits(user.id, CREDIT_COSTS.ANALYSIS));
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }

  try {
    const result = await analyzeDocumentVersion(document.currentVersionId);

    await chargeCredits({
      userId: user.id,
      action: "ANALYSIS",
      cost: CREDIT_COSTS.ANALYSIS,
      metered,
      metadata: { documentId: document.id, checkId: result.checkId },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AnalysisError) {
      // Translate provider billing/auth problems into something a student can
      // act on, without exposing internal details.
      const raw = err.message;
      if (/credit balance is too low|insufficient/i.test(raw)) {
        return NextResponse.json(
          {
            error:
              "The analysis service is out of credit. Please top up the Anthropic API balance, then try again.",
          },
          { status: 402 },
        );
      }
      if (/authentication|invalid x-api-key|401/i.test(raw)) {
        return NextResponse.json(
          {
            error:
              "The analysis service key is not valid. Please check ANTHROPIC_API_KEY.",
          },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: raw }, { status: 422 });
    }
    // AI/provider failures must not leak internals to the student.
    console.error("Analysis failed:", err);
    return NextResponse.json(
      { error: "Analysis could not be completed. Please try again." },
      { status: 502 },
    );
  }
}
