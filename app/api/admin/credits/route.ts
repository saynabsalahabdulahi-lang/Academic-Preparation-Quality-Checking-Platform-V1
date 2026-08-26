import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

const grantSchema = z.object({
  userId: z.string().trim().min(1),
  // Positive adds credits, negative removes them; the balance never goes below 0.
  amount: z.coerce.number().int().min(-1000).max(1000),
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Administrators only." }, { status: 403 });
  }

  const parsed = grantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { userId, amount } = parsed.data;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const newBalance = Math.max(0, target.creditBalance + amount);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: newBalance },
    select: { id: true, creditBalance: true },
  });

  return NextResponse.json({ user });
}
