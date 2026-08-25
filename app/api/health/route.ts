import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight diagnostics: reports which pieces are configured/reachable.
// Returns only booleans and short status strings — never secret values.
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DATABASE_URL_UNPOOLED: Boolean(process.env.DATABASE_URL_UNPOOLED),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  let database = "unknown";
  let tables = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
    try {
      await prisma.user.count();
      tables = "ready";
    } catch {
      tables = "missing (run a redeploy to create them)";
    }
  } catch (err) {
    database = `error: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`;
  }

  const ready =
    env.DATABASE_URL &&
    env.AUTH_SECRET &&
    database === "connected" &&
    tables === "ready";

  return NextResponse.json(
    {
      ready,
      env,
      database,
      tables,
      uploads_configured: env.BLOB_READ_WRITE_TOKEN,
      analysis_configured: env.ANTHROPIC_API_KEY,
    },
    { status: 200 },
  );
}
