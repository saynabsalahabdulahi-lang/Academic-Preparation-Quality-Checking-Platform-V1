# Academic Prepare — working notes for Claude

Production web app helping graduate students **prepare/improve their own**
academic documents before submission. **Not** a plagiarism/AI-detection bypass —
never frame or build any feature that way.

## Stack
Next.js (App Router) + TypeScript · Prisma + PostgreSQL (Neon) · Auth.js
(NextAuth v5, credentials + JWT) · Vercel Blob storage · Anthropic Claude behind
a swappable `AIProvider` · Tailwind · Vitest.

## Commands
- `npm run dev` / `build` / `start`
- `npm run typecheck` · `npm run lint` · `npm run test`
- `npm run db:migrate` · `db:push` · `db:seed` · `db:studio`

Before committing, run **typecheck + lint + test + build**. Keep them all green.

## Architecture rules
- **Model choice is a cost decision.** Default is `claude-sonnet-5`; override
  with `ANTHROPIC_MODEL` (`claude-opus-5` deepest, `claude-haiku-4-5` cheapest).
  Analysis makes one call per chunk, so cost scales with document length.
- **AI access only through `lib/ai` (`AIProvider`)**. Prompts live in
  `lib/ai/prompts` (versioned via `PROMPT_VERSION`); every AI response is
  validated with the Zod schemas in `lib/ai/schemas.ts`. Never leak raw
  provider errors to users.
- **Storage only through `lib/storage` (`Storage`)**. Files go to object
  storage; the DB stores metadata + `storageKey`. Never store files in the DB;
  never expose blob URLs to the client (stream via `get()`).
- **Scores are computed from real checks** (`lib/analysis/score.ts`), never
  produced by the AI and never inflated because a rewrite happened.
- **Meaning preservation**: rewrites must never invent findings/citations/
  references or change numbers; `checkRevision` surfaces warnings.

## Security invariants (do not regress)
- Every document/version/section/revision query is **owner-scoped**
  (`where: { ..., ownerId }` or verified via `lib/auth/ownership.ts`). A user
  must never reach another user's document by changing an id. Tested in
  `tests/ownership.test.ts`.
- Uploads validated for real DOCX format (magic bytes + `word/document.xml`),
  size, and extension — never trust client filename/MIME.
- Usage/credits enforced **server-side**; rate limits on write/AI endpoints.
- Secrets only in env vars; `.env` is gitignored.

## Data model highlights
`User` → `Document` → `DocumentVersion` → `DocumentSection`; analysis produces
`Check` + `Issue`; `Revision` targets a section and drives new versions.
Guidelines hang off `Program` (University→College→Department→Program).

## Status
Phases 1–13 done; Phase 14 (deploy) needs provisioned Neon + Blob + env vars.
See README for the deployment checklist.
