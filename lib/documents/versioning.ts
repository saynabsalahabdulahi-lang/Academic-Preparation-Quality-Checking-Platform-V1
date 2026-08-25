import { prisma } from "@/lib/db";

export type SectionInput = {
  id: string;
  order: number;
  type: string;
  heading: string | null;
  text: string;
};

/**
 * Pure: apply a map of accepted revisions (sectionId → new text) to a set of
 * sections, producing the content for a new version. Sections without an
 * accepted revision are carried over unchanged; order/type/heading preserved.
 */
export function applyRevisionsToSections(
  sections: SectionInput[],
  acceptedBySection: Map<string, string>,
): { order: number; type: string; heading: string | null; text: string }[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      order: s.order,
      type: s.type,
      heading: s.heading,
      text: acceptedBySection.get(s.id) ?? s.text,
    }));
}

/**
 * Create a new DocumentVersion by applying every accepted (or edited) revision
 * of the current version to its sections. Returns the new version. The original
 * version is never modified — full history is preserved.
 */
export async function createRevisedVersion(documentId: string) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({
      where: { id: documentId },
      select: { id: true, currentVersionId: true },
    });
    if (!document?.currentVersionId) {
      throw new Error("Document has no current version.");
    }

    const current = await tx.documentVersion.findUnique({
      where: { id: document.currentVersionId },
      include: { sections: true },
    });
    if (!current) throw new Error("Current version not found.");

    // Latest accepted/edited revision per section.
    const revisions = await tx.revision.findMany({
      where: {
        versionId: current.id,
        status: { in: ["ACCEPTED", "EDITED"] },
        sectionId: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });

    if (revisions.length === 0) {
      throw new Error("No accepted revisions to apply.");
    }

    const acceptedBySection = new Map<string, string>();
    for (const r of revisions) {
      if (r.sectionId) acceptedBySection.set(r.sectionId, r.revisedText);
    }

    const newSections = applyRevisionsToSections(
      current.sections.map((s) => ({
        id: s.id,
        order: s.order,
        type: s.type,
        heading: s.heading,
        text: s.text,
      })),
      acceptedBySection,
    );

    const maxVersion = await tx.documentVersion.aggregate({
      where: { documentId },
      _max: { versionNumber: true },
    });
    const nextNumber = (maxVersion._max.versionNumber ?? 0) + 1;

    const newVersion = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextNumber,
        label: `Revision ${nextNumber}`,
        // Carries the same source file; export (Phase 12) regenerates the DOCX.
        storageKey: current.storageKey,
        originalFilename: current.originalFilename,
        mimeType: current.mimeType,
        sizeBytes: current.sizeBytes,
        processingStatus: "READY",
        sections: {
          create: newSections.map((s) => ({
            order: s.order,
            type: s.type as never,
            heading: s.heading,
            text: s.text,
          })),
        },
      },
    });

    await tx.document.update({
      where: { id: documentId },
      data: { currentVersionId: newVersion.id, status: "READY_FOR_REVIEW" },
    });

    return newVersion;
  });
}
