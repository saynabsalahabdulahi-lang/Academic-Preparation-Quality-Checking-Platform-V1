import type { Prisma, UsageAction } from "@prisma/client";

import { prisma } from "@/lib/db";

export class InsufficientCreditsError extends Error {
  constructor(message = "You have no remaining credits.") {
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
