import type { RevisionAction, RevisionStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAIProvider, type AIProvider } from "@/lib/ai";
import { ForbiddenError, NotFoundError } from "@/lib/auth/ownership";

export class RevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevisionError";
  }
}

/**
 * Create a rewrite for a specific section of a document the user owns.
 * Returns the persisted Revision (status PENDING) with structured details:
 * original/revised text, what changed, why, confidence, and warnings.
 */
export async function createSectionRevision(params: {
  userId: string;
  isAdmin: boolean;
  sectionId: string;
  action: RevisionAction;
  previousRevisionId?: string;
  styleGuidance?: string;
  provider?: AIProvider;
}) {
  const { userId, isAdmin, sectionId, action } = params;

  const section = await prisma.documentSection.findUnique({
    where: { id: sectionId },
    include: {
      version: { select: { id: true, document: { select: { ownerId: true } } } },
    },
  });
  if (!section) throw new NotFoundError("Section not found.");
  if (section.version.document.ownerId !== userId && !isAdmin) {
    throw new ForbiddenError();
  }

  let previousRevisionText: string | undefined;
  let attempt = 1;
  if (params.previousRevisionId) {
    const prev = await prisma.revision.findUnique({
      where: { id: params.previousRevisionId },
      select: { revisedText: true, attempt: true, sectionId: true },
    });
    if (prev?.sectionId === sectionId) {
      previousRevisionText = prev.revisedText;
      attempt = prev.attempt + 1;
    }
  }

  const provider = params.provider ?? getAIProvider();
  const input = {
    text: section.text,
    action,
    previousRevision: previousRevisionText,
    styleGuidance: params.styleGuidance,
  };
  const result = previousRevisionText
    ? await provider.rewriteAgain(input)
    : await provider.rewriteText(input);

  // Meaning-preservation check adds warnings but never blocks the student.
  let warnings = result.warnings ?? [];
  try {
    const check = await provider.checkRevision({
      originalText: section.text,
      revisedText: result.revised_text,
    });
    if (!check.meaning_preserved) {
      warnings = [
        ...warnings,
        "Automated check flagged a possible meaning change — please review carefully.",
        ...check.warnings,
      ];
    }
  } catch {
    // Non-fatal; proceed without the extra check.
  }

  return prisma.revision.create({
    data: {
      versionId: section.version.id,
      sectionId,
      action,
      originalText: section.text,
      revisedText: result.revised_text,
      whatChanged: result.what_changed ?? null,
      whyChanged: result.why_changed ?? null,
      confidence: result.confidence ?? null,
      warnings,
      attempt,
      status: "PENDING",
    },
  });
}

/** Accept, reject, or edit a revision the user owns. */
export async function updateRevisionStatus(params: {
  userId: string;
  isAdmin: boolean;
  revisionId: string;
  status: RevisionStatus;
  editedText?: string;
}) {
  const { userId, isAdmin, revisionId, status } = params;

  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    include: {
      version: { select: { document: { select: { ownerId: true } } } },
    },
  });
  if (!revision) throw new NotFoundError("Revision not found.");
  if (revision.version.document.ownerId !== userId && !isAdmin) {
    throw new ForbiddenError();
  }

  if (status === "EDITED") {
    const text = params.editedText?.trim();
    if (!text) throw new RevisionError("Edited text is required.");
    return prisma.revision.update({
      where: { id: revisionId },
      data: { status: "EDITED", revisedText: text },
    });
  }

  return prisma.revision.update({
    where: { id: revisionId },
    data: { status },
  });
}
