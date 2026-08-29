import type { Prisma, UsageAction } from "@prisma/client";

import { prisma } from "@/lib/db";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : fallback;
}

/**
 * Master switch. With CREDITS_ENABLED="false" nobody is metered: every student
 * gets unrestricted access to upload, analysis and rewrite. Usage is still
 * recorded, so spend remains visible — but the only remaining ceiling is the
 * provider's own billing limit, so keep a monthly cap set there.
 */
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED !== "false";

/**
 * Credit price per action, weighted by what each actually costs to run: an
 * analysis reads the whole document in several AI passes, while a rewrite
 * touches a single section — roughly a tenth of the work. Charging both one
 * credit let a student spend many times the intended budget by re-analysing.
 * Override per deployment with UPLOAD_CREDITS / ANALYSIS_CREDITS /
 * REWRITE_CREDITS.
 */
export const CREDIT_COSTS = {
  DOCUMENT_UPLOAD: envInt("UPLOAD_CREDITS", 1),
  ANALYSIS: envInt("ANALYSIS_CREDITS", 3),
  REWRITE: envInt("REWRITE_CREDITS", 1),
  EXPORT: 0,
} as const;

export class InsufficientCreditsError extends Error {
  constructor(
    message = "You have used all the credits for your free document. Contact your administrator to continue.",
  ) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Credits meter student usage. Administrators run the platform, so their work
 * is recorded for reporting but never blocked or debited.
 */
export async function assertCredits(
  userId: string,
  cost: number,
): Promise<{ metered: boolean }> {
  if (!CREDITS_ENABLED) return { metered: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, role: true },
  });
  if (!user) throw new InsufficientCreditsError("Account not found.");

  // Administrators run the platform, so their work is never blocked.
  if (user.role === "ADMIN") return { metered: false };

  if (user.creditBalance < cost) throw new InsufficientCreditsError();
  return { metered: true };
}

/**
 * Record usage and debit the balance. Unmetered work (administrators, or
 * credits switched off entirely) is still recorded at zero so usage reporting
 * stays complete.
 */
export async function chargeCredits(params: {
  userId: string;
  action: UsageAction;
  cost: number;
  metered: boolean;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  const { userId, action, cost, metered, metadata } = params;
  const credits = metered ? cost : 0;

  await prisma.$transaction([
    ...(credits > 0
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { creditBalance: { decrement: credits } },
          }),
        ]
      : []),
    prisma.usageRecord.create({
      data: {
        userId,
        action,
        credits,
        metadata: metadata ?? undefined,
      },
    }),
  ]);
}
