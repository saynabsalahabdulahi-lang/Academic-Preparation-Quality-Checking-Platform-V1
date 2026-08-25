import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { buildDocx } from "@/lib/docx/export";
import { DOCX_MIME } from "@/lib/upload/validate";

export const runtime = "nodejs";

function safeFilename(title: string): string {
  const base = title.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "document";
  return `${base.slice(0, 80)} (revised).docx`;
}

// Generate and download the current version as a .docx.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Owner-scoped fetch (IDOR defense).
  const document = await prisma.document.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    select: { id: true, title: true, currentVersionId: true },
  });
  if (!document?.currentVersionId) {
    return new Response(JSON.stringify({ error: "Document not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: document.currentVersionId },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!version || version.sections.length === 0) {
    return new Response(JSON.stringify({ error: "Nothing to export." }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const buffer = await buildDocx(
    version.sections.map((s) => ({
      type: s.type,
      heading: s.heading,
      text: s.text,
    })),
  );

  await prisma.usageRecord.create({
    data: {
      userId: user.id,
      action: "EXPORT",
      credits: 0,
      metadata: { documentId: id, versionId: version.id },
    },
  });

  // Copy into a fresh ArrayBuffer-backed view so the body satisfies BlobPart.
  const body = new Uint8Array(buffer);
  return new Response(new Blob([body], { type: DOCX_MIME }), {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(document.title)}"`,
      "X-Export-Warning":
        "Regenerated document — some original formatting may not be preserved.",
    },
  });
}
