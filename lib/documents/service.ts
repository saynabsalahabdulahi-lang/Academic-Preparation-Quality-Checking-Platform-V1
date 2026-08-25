import type { DocumentCategory } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getStorage, generateStorageKey } from "@/lib/storage";
import { extractDocx } from "@/lib/docx/parse";
import { DOCX_MIME } from "@/lib/upload/validate";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("You have no remaining credits.");
    this.name = "InsufficientCreditsError";
  }
}

const UPLOAD_CREDIT_COST = 1;

/**
 * Create a document from a validated upload: store the file, create the
 * Document + first DocumentVersion, decrement credits, and record usage.
 * Extraction runs separately via `processDocumentVersion`.
 */
export async function createDocumentFromUpload(params: {
  ownerId: string;
  title: string;
  category: DocumentCategory;
  programId?: string | null;
  buffer: Uint8Array;
  filename: string;
}) {
  const { ownerId, title, category, programId, buffer, filename } = params;

  // Enforce credits server-side (never trust the client).
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { creditBalance: true },
  });
  if (!user || user.creditBalance < UPLOAD_CREDIT_COST) {
    throw new InsufficientCreditsError();
  }

  const storageKey = generateStorageKey();
  await getStorage().put(storageKey, buffer, DOCX_MIME);

  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        ownerId,
        title,
        category,
        programId: programId ?? null,
        status: "PROCESSING",
      },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        label: "Original upload",
        storageKey,
        originalFilename: filename,
        mimeType: DOCX_MIME,
        sizeBytes: buffer.byteLength,
        processingStatus: "PENDING",
      },
    });

    await tx.document.update({
      where: { id: doc.id },
      data: { currentVersionId: version.id },
    });

    await tx.user.update({
      where: { id: ownerId },
      data: { creditBalance: { decrement: UPLOAD_CREDIT_COST } },
    });

    await tx.usageRecord.create({
      data: {
        userId: ownerId,
        action: "DOCUMENT_UPLOAD",
        credits: UPLOAD_CREDIT_COST,
        metadata: { documentId: doc.id },
      },
    });

    return { ...doc, currentVersionId: version.id };
  });

  return document;
}

/**
 * Extract the DOCX representation for a version and persist its sections.
 * Designed to be callable inline (V1) or from a background worker/queue later.
 */
export async function processDocumentVersion(versionId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, documentId: true, storageKey: true },
  });
  if (!version?.storageKey) {
    throw new Error("Version has no stored file to process.");
  }

  await prisma.documentVersion.update({
    where: { id: versionId },
    data: { processingStatus: "PROCESSING" },
  });

  try {
    const buffer = await getStorage().get(version.storageKey);
    const extracted = await extractDocx(buffer);

    await prisma.$transaction(async (tx) => {
      // Idempotent re-processing: clear any prior sections for this version.
      await tx.documentSection.deleteMany({ where: { versionId } });

      if (extracted.sections.length > 0) {
        await tx.documentSection.createMany({
          data: extracted.sections.map((s) => ({
            versionId,
            order: s.order,
            type: s.type,
            heading: s.heading ?? null,
            text: s.text,
          })),
        });
      }

      await tx.documentVersion.update({
        where: { id: versionId },
        data: {
          processingStatus: "READY",
          processingError: extracted.warnings.length
            ? extracted.warnings.join("; ")
            : null,
        },
      });

      // Extraction done; document awaits analysis (Phase 6).
      await tx.document.update({
        where: { id: version.documentId },
        data: { status: "UPLOADED" },
      });
    });

    return { ok: true as const, wordCount: extracted.wordCount };
  } catch (err) {
    await prisma.documentVersion.update({
      where: { id: versionId },
      data: {
        processingStatus: "FAILED",
        processingError:
          err instanceof Error ? err.message : "Extraction failed.",
      },
    });
    throw err;
  }
}
