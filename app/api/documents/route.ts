import { NextResponse } from "next/server";
import { DocumentCategory } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/session";
import { validateDocx, DEFAULT_MAX_UPLOAD_BYTES } from "@/lib/upload/validate";
import { rateLimit } from "@/lib/rate-limit";
import {
  createDocumentFromUpload,
  processDocumentVersion,
  InsufficientCreditsError,
} from "@/lib/documents/service";

// Node runtime: uses Prisma, bcrypt-free but Node-only libs (jszip, fs).
export const runtime = "nodejs";

const VALID_CATEGORIES = new Set(Object.values(DocumentCategory));

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Rate limit: 10 uploads / 5 minutes per user.
  const rl = rateLimit(`upload:${user.id}`, {
    limit: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const programId = form.get("programId") ? String(form.get("programId")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category as DocumentCategory)) {
    return NextResponse.json(
      { error: "Please choose a valid document type." },
      { status: 400 },
    );
  }

  // Reject oversized uploads before buffering the whole file where possible.
  if (file.size > DEFAULT_MAX_UPLOAD_BYTES) {
    const mb = Math.round(DEFAULT_MAX_UPLOAD_BYTES / (1024 * 1024));
    return NextResponse.json(
      { error: `File exceeds the ${mb} MB limit.` },
      { status: 413 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Validate real DOCX format (magic bytes + internal structure).
  const valid = await validateDocx(buffer, file.name);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  try {
    const document = await createDocumentFromUpload({
      ownerId: user.id,
      title,
      category: category as DocumentCategory,
      programId,
      buffer,
      filename: file.name,
    });

    // V1: extract inline (fast). This is isolated so it can later move to a
    // background worker/queue triggered after the response.
    if (document.currentVersionId) {
      try {
        await processDocumentVersion(document.currentVersionId);
      } catch {
        // Extraction failure is recorded on the version; upload still succeeds.
      }
    }

    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    // Never leak internal errors to the client.
    console.error("Document upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
