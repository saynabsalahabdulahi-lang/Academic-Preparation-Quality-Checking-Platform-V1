import { prisma } from "@/lib/db";
import { getAIProvider, type AIProvider } from "@/lib/ai";
import { resolveGuideline } from "@/lib/academic/service";
import { computeScores } from "@/lib/analysis/score";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import type { GuidelineContext } from "@/lib/ai/provider";

// A long document is analysed in several smaller passes rather than one huge
// request: each chunk returns a bounded response (so it is never truncated
// mid-JSON) and the chunks run concurrently to stay inside the request budget.
const CHUNK_CHARS = 6_000;
const MAX_CHUNKS = 8;

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

/** Split the document into chunks, keeping whole sections together. */
export function buildChunks(
  sections: { type: string; heading: string | null; text: string }[],
  chunkChars: number = CHUNK_CHARS,
  maxChunks: number = MAX_CHUNKS,
): { chunks: string[]; truncated: boolean } {
  const parts = sections.map((s) =>
    s.type === "HEADING" && s.heading ? `\n## ${s.heading}` : s.text,
  );

  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current && current.length + part.length + 2 > chunkChars) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${part}` : part;
  }
  if (current) chunks.push(current);

  const truncated = chunks.length > maxChunks;
  return { chunks: chunks.slice(0, maxChunks), truncated };
}

/**
 * Run the analysis engine over a document version: gather text, apply guideline
 * context, ask the AI provider for issues, compute the Academic Readiness
 * scores from those issues, and persist a Check + Issue records. Idempotent per
 * version (re-running replaces the version's prior analysis).
 */
export async function analyzeDocumentVersion(
  versionId: string,
  opts?: { provider?: AIProvider },
) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      sections: { orderBy: { order: "asc" } },
      document: { select: { id: true, category: true, programId: true } },
    },
  });
  if (!version) throw new AnalysisError("Document version not found.");
  if (version.sections.length === 0) {
    throw new AnalysisError("This document has no extracted content to analyze.");
  }

  const { document } = version;

  let guidelineContext: GuidelineContext | undefined;
  if (document.programId) {
    const guideline = await resolveGuideline(
      document.programId,
      document.category,
    );
    if (guideline) {
      guidelineContext = {
        citationStyle: guideline.citationStyle,
        referenceStyle: guideline.referenceStyle,
        requiredSections: guideline.requiredSections,
        minWords: guideline.minWords,
        maxWords: guideline.maxWords,
        documentCategory: document.category,
        extraRules: guideline.rules ?? undefined,
      };
    }
  }

  const { chunks, truncated } = buildChunks(version.sections);

  const provider = opts?.provider ?? getAIProvider();

  // Analyse chunks concurrently and merge. One failing chunk must not lose the
  // whole report, but if every chunk fails the analysis genuinely failed.
  const settled = await Promise.allSettled(
    chunks.map((text) =>
      provider.analyzeDocument({
        text,
        documentCategory: document.category,
        guideline: guidelineContext,
      }),
    ),
  );

  const succeeded = settled.filter(
    (r): r is PromiseFulfilledResult<Awaited<ReturnType<AIProvider["analyzeDocument"]>>> =>
      r.status === "fulfilled",
  );
  if (succeeded.length === 0) {
    const reason = settled.find((r) => r.status === "rejected");
    throw new AnalysisError(
      reason && "reason" in reason
        ? `The analysis service could not process this document. ${String(reason.reason).slice(0, 200)}`
        : "The analysis service could not process this document.",
    );
  }

  const issues = succeeded.flatMap((r) => r.value.issues);
  const partial = succeeded.length < settled.length;

  const scores = computeScores(
    issues.map((i) => ({ category: i.category, severity: i.severity })),
  );

  const check = await prisma.$transaction(async (tx) => {
    // Idempotent re-analysis of this version.
    await tx.issue.deleteMany({ where: { versionId } });
    await tx.check.deleteMany({ where: { versionId } });

    const created = await tx.check.create({
      data: {
        versionId,
        structureScore: scores.structure,
        academicScore: scores.academic,
        citationScore: scores.citation,
        referenceScore: scores.reference,
        complianceScore: scores.compliance,
        clarityScore: scores.clarity,
        overallScore: scores.overall,
        metadata: {
          promptVersion: PROMPT_VERSION,
          issueCount: issues.length,
          truncated,
          partial,
          chunks: settled.length,
          usedGuideline: Boolean(guidelineContext),
        },
      },
    });

    if (issues.length > 0) {
      await tx.issue.createMany({
        data: issues.map((i) => ({
          versionId,
          checkId: created.id,
          category: i.category,
          severity: i.severity,
          location: i.location ?? null,
          originalText: i.original_text ?? null,
          explanation: i.explanation,
          suggestedAction: i.suggested_action ?? null,
          suggestedRevision: i.suggested_revision ?? null,
        })),
      });
    }

    await tx.document.update({
      where: { id: document.id },
      data: { status: "ANALYSIS_COMPLETE" },
    });

    return created;
  });

  return {
    checkId: check.id,
    scores,
    issueCount: issues.length,
    truncated,
  };
}
