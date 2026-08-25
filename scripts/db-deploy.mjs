// Applies the Prisma schema to the database during the build.
//
// On Vercel the database env vars are present at build time, so this creates
// (or updates) the tables automatically on every deploy. Locally / in CI
// without a database configured, it safely skips so `next build` still runs.
//
// IMPORTANT: this step is best-effort and must NEVER fail the build. If the
// database is unreachable at build time, we still want the app to deploy (so
// env vars take effect and pages load); tables can be created separately.
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("• No DATABASE_URL set at build time — skipping prisma db push.");
} else {
  try {
    console.log("• Applying Prisma schema to the database (prisma db push)…");
    execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
    console.log("• Database schema is up to date.");
  } catch (err) {
    console.warn(
      "• prisma db push failed (continuing build anyway):",
      err?.message ?? err,
    );
  }
}
