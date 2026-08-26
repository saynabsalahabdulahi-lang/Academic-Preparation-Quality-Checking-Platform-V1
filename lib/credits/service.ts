import type { Prisma, UsageAction } from "@prisma/client";

import { prisma } from "@/lib/db";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : fallback;
}

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
  constructor(message = "You do not have enough credits left.") {
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
): Promise<{ isAdmin: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, role: true },
  });
  if (!user) throw new InsufficientCreditsError("Account not found.");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && user.creditBalance < cost) {
    throw new InsufficientCreditsError();
  }
  return { isAdmin };
}

/** Record usage and debit the balance (administrators are not debited). */
export async function chargeCredits(params: {
  userId: string;
  action: UsageAction;
  cost: number;
  isAdmin: boolean;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  const { userId, action, cost, isAdmin, metadata } = params;
  const credits = isAdmin ? 0 : cost;

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
