// Applies the Prisma schema to the database during the build.
//
// On Vercel the database env vars are present at build time, so this creates
// (or updates) the tables automatically on every deploy. Locally / in CI
// without a database configured, it safely skips so `next build` still runs.
import { execSync } from "node:child_process";

if (process.env.DATABASE_URL) {
  console.log("• Applying Prisma schema to the database (prisma db push)…");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else {
  console.log("• No DATABASE_URL set — skipping prisma db push.");
}
