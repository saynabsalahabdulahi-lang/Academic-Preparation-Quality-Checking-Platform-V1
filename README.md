# Academic Prepare

A production-quality web application that helps Master's and PhD students
**prepare and improve their own academic documents** before submitting them to
an instructor or university.

The platform helps students identify academic writing problems, understand
_why_ something is a problem, correct grammar and clarity, improve academic
structure, check program guidelines, improve citation/reference consistency,
revise passages in their own writing style, compare original vs. revised text,
and prepare a cleaner final Word document.

> **Integrity statement.** Academic Prepare is **not** designed to bypass
> Turnitin, plagiarism detection, AI detection, or any university
> academic-integrity policy. The "Academic Readiness Score" is an internal
> quality indicator, not a prediction of plagiarism or AI-detection results.

---

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript                  |
| Database       | PostgreSQL (Neon) via Prisma ORM                   |
| Authentication | Auth.js (NextAuth v5), credentials + JWT sessions  |
| File storage   | Vercel Blob (metadata in DB, files in object store)|
| AI provider    | Anthropic Claude, behind a swappable `AIProvider`  |
| Styling        | Tailwind CSS                                        |
| Tests          | Vitest                                              |
| Hosting        | Vercel                                              |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env      # fill in real values (see below)

# 3. Set up the database
npm run db:migrate        # create tables (requires DATABASE_URL/DIRECT_URL)
npm run db:seed           # optional: sample university/program/guideline

# 4. Run
npm run dev               # http://localhost:3000
```

### Environment variables

See `.env.example` for the full list. Required to run:

- `DATABASE_URL` / `DIRECT_URL` — Neon Postgres (pooled + direct).
- `AUTH_SECRET` — `openssl rand -base64 32`.
- `ANTHROPIC_API_KEY` — server-side only, never exposed to the client.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (added once storage is provisioned).

**Never commit `.env` or any secret.** In production, set these in the Vercel
project settings.

## Project structure

```
app/                      # Next.js App Router (UI + route handlers)
  (auth)/login            # sign-in page
  (auth)/register         # registration page
  dashboard/              # protected student dashboard
  api/auth/[...nextauth]/ # Auth.js handler
  api/register/           # account creation endpoint
auth.ts / auth.config.ts  # Auth.js configuration (Node + edge-safe split)
middleware.ts             # route protection
lib/
  db.ts                   # Prisma client singleton
  auth/                   # password hashing, session + ownership helpers
  ai/                     # AIProvider interface, Anthropic impl, prompts, schemas
  validation/             # Zod input schemas
prisma/
  schema.prisma           # data model
  seed.ts                 # sample data
tests/                    # Vitest unit tests
```

## Security foundations

- **Ownership / IDOR defense.** Every document-owned query is scoped by owner;
  `lib/auth/ownership.ts` centralizes the check. A student can never read
  another student's document by changing an id. (`tests/ownership.test.ts`)
- **Passwords** are hashed with bcrypt (`lib/auth/password.ts`).
- **Input validation** with Zod on every external input.
- **Secrets** live only in environment variables, server-side.
- File uploads (Phase 3) will validate real file format (magic bytes), size,
  and use generated storage keys — never trusting the client filename/MIME.

## AI architecture

All AI access goes through the `AIProvider` interface (`lib/ai/provider.ts`),
so the provider can be swapped without touching business logic. Prompts are
centralized and versioned (`lib/ai/prompts/`), and **every** model response is
validated with Zod (`lib/ai/schemas.ts`) before use, with a safe retry and
user-friendly error handling — raw provider errors are never shown to students.

## Development phases

1. ✅ Inspect existing project _(empty repo — greenfield)_
2. ✅ Authentication + database foundation
3. ✅ Document upload + secure storage
4. ✅ DOCX extraction + document representation
5. ✅ University/program/guideline models & selectors
6. ✅ Academic analysis engine
7. ✅ Issue dashboard (readiness report + ranked issues)
8. ✅ Preparation / rewrite engine
9. ✅ Original vs. revised comparison
10. ✅ Version history (view / restore)
11. ✅ Re-check after revision (before/after)
12. ✅ DOCX export
13. ✅ Testing / security hardening
14. ◑ Vercel production deployment _(needs provisioned env — see below)_

### Deployment checklist (Phase 14)

The application build (`npm run build`) and all tests pass locally. To go live
on Vercel:

1. **Provision Neon Postgres** and set `DATABASE_URL` + `DIRECT_URL` in Vercel.
2. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `ANTHROPIC_API_KEY`.
3. Add **Vercel Blob** storage (provides `BLOB_READ_WRITE_TOKEN`).
4. Apply the schema: `npx prisma migrate deploy` (or `prisma db push`) against
   the production database. Optionally `npm run db:seed` for sample data.
5. Deploy (push to the connected branch). Verify: sign-up/sign-in, upload,
   analysis, rewrite, version creation, download, and that User A cannot access
   User B's document.

> Serverless note: analysis/rewrite routes set `maxDuration = 60`. Very large
> documents may need a background worker (the pipeline is already structured to
> allow moving `processDocumentVersion` / `analyzeDocumentVersion` off-request).

### Security hardening (Phase 13)

- Owner-scoped queries on every document/version/section/revision route (IDOR).
- Baseline security headers (HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy); `x-powered-by` disabled.
- Rate limiting on register, upload, analyze, and rewrite endpoints.
- bcrypt password hashing; Zod validation on all external input; AI responses
  validated before use; internal errors never leaked to clients.

### Vercel note

Heavy DOCX parsing + multi-section AI analysis can exceed Vercel serverless
function timeouts. Phases 3–6 are designed around an **async job model**
(upload → enqueue → poll status) rather than a single long request. If
processing outgrows serverless limits, a dedicated worker will be introduced.

## Scripts

```bash
npm run dev         # start dev server
npm run build       # prisma generate + next build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run db:migrate  # prisma migrate dev
npm run db:seed     # seed sample data
npm run db:studio   # prisma studio
```
