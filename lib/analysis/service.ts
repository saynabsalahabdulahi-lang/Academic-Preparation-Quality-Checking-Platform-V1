import { prisma } from "@/lib/db";
import { getAIProvider, type AIProvider } from "@/lib/ai";
import { resolveGuideline } from "@/lib/academic/service";
import { computeScores } from "@/lib/analysis/score";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import type { GuidelineContext } from "@/lib/ai/provider";

// Cap the text sent for a single analysis pass. Larger documents are truncated
// with a warning; section-level analysis for long documents is a later
// enhancement (and a reason the pipeline is kept async-friendly).
const MAX_ANALYSIS_CHARS = 24_000;

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

function buildText(
  sections: { type: string; heading: string | null; text: string }[],
): { text: string; truncated: boolean } {
  const parts = sections.map((s) =>
    s.type === "HEADING" && s.heading ? `\n## ${s.heading}` : s.text,
  );
  const joined = parts.join("\n\n");
  if (joined.length <= MAX_ANALYSIS_CHARS) {
    return { text: joined, truncated: false };
  }
  return { text: joined.slice(0, MAX_ANALYSIS_CHARS), truncated: true };
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

  const { text, truncated } = buildText(version.sections);

  const provider = opts?.provider ?? getAIProvider();
  const result = await provider.analyzeDocument({
    text,
    documentCategory: document.category,
    guideline: guidelineContext,
  });

  const scores = computeScores(
    result.issues.map((i) => ({ category: i.category, severity: i.severity })),
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
          issueCount: result.issues.length,
          truncated,
          usedGuideline: Boolean(guidelineContext),
        },
      },
    });

    if (result.issues.length > 0) {
      await tx.issue.createMany({
        data: result.issues.map((i) => ({
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
    issueCount: result.issues.length,
    truncated,
  };
}
