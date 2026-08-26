import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getStorage, generateStorageKey } from "@/lib/storage";
import { getAIProvider } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Round-trip a tiny file through storage to surface the real error, if any. */
async function testStorage(): Promise<string> {
  const key = generateStorageKey("healthcheck");
  const storage = getStorage();
  try {
    await storage.put(key, new TextEncoder().encode("ok"), "text/plain");
    const back = await storage.get(key);
    const value = new TextDecoder().decode(back);
    await storage.delete(key).catch(() => {});
    return value === "ok" ? "working" : "read-back mismatch";
  } catch (err) {
    return `error: ${err instanceof Error ? err.message.slice(0, 200) : "unknown"}`;
  }
}

/** Run one tiny analysis call to surface the real AI error, if any. */
async function testAI(): Promise<string> {
  try {
    const started = Date.now();
    const result = await getAIProvider().analyzeDocument({
      text: "This sentance have a grammar problem and it are unclear.",
      documentCategory: "ASSIGNMENT",
    });
    return `working (${result.issues.length} issues, ${Date.now() - started}ms)`;
  } catch (err) {
    return `error: ${err instanceof Error ? err.message.slice(0, 300) : "unknown"}`;
  }
}

// Lightweight diagnostics: reports which pieces are configured/reachable.
// Returns only booleans and short status strings — never secret values.
// Add ?test=storage to perform a real upload/download round-trip.
export async function GET(request: Request) {
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

  const test = new URL(request.url).searchParams.get("test");
  const storage = test === "storage" ? await testStorage() : "not tested";
  const ai = test === "ai" ? await testAI() : "not tested";

  return NextResponse.json(
    {
      ready,
      version: "2025-08-25-analysis-fix",
      env,
      storage,
      ai,
      database,
      tables,
      uploads_configured: env.BLOB_READ_WRITE_TOKEN,
      analysis_configured: env.ANTHROPIC_API_KEY,
    },
    { status: 200 },
  );
}
