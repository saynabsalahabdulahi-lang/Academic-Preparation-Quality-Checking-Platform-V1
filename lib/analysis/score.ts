import type { IssueCategory, IssueSeverity } from "@prisma/client";

/**
 * Academic Readiness scoring.
 *
 * Scores are computed deterministically from the issues actually found — they
 * are NOT produced by the AI and are never inflated because a rewrite happened.
 * Each dimension starts at 100 and loses points per issue by severity, capped
 * at 0. This is an internal quality indicator, not a plagiarism/AI-detection
 * prediction.
 */

export interface ScoreInput {
  category: IssueCategory;
  severity: IssueSeverity;
}

export interface Scores {
  structure: number;
  academic: number;
  citation: number;
  reference: number;
  compliance: number;
  clarity: number;
  overall: number;
}

const SEVERITY_PENALTY: Record<IssueSeverity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 4,
  SUGGESTION: 2,
};

type Dimension =
  | "structure"
  | "academic"
  | "citation"
  | "reference"
  | "compliance"
  | "clarity";

const CATEGORY_DIMENSION: Record<IssueCategory, Dimension> = {
  SECTION_STRUCTURE: "structure",
  PARAGRAPH_STRUCTURE: "structure",
  LOGICAL_FLOW: "structure",
  COMPLETENESS: "structure",
  GRAMMAR: "academic",
  SPELLING: "academic",
  ACADEMIC_TONE: "academic",
  REPETITION: "academic",
  TERMINOLOGY_CONSISTENCY: "academic",
  CITATION_CONSISTENCY: "citation",
  REFERENCE_CONSISTENCY: "reference",
  GUIDELINE_COMPLIANCE: "compliance",
  CLARITY: "clarity",
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Scale penalties by document length so a score reflects the *rate* of issues,
 * not the sheer size of the document. Without this, a long thesis is punished
 * simply for containing more text than a short assignment.
 */
function densityFactor(wordCount: number): number {
  const REFERENCE_WORDS = 1000;
  if (wordCount <= REFERENCE_WORDS) return 1;
  return REFERENCE_WORDS / wordCount;
}

export function computeScores(
  issues: ScoreInput[],
  wordCount = 0,
): Scores {
  const factor = densityFactor(wordCount);
  const penalties: Record<Dimension, number> = {
    structure: 0,
    academic: 0,
    citation: 0,
    reference: 0,
    compliance: 0,
    clarity: 0,
  };

  for (const issue of issues) {
    const dim = CATEGORY_DIMENSION[issue.category];
    penalties[dim] += SEVERITY_PENALTY[issue.severity] * factor;
  }

  const dims = {
    structure: clamp(100 - penalties.structure),
    academic: clamp(100 - penalties.academic),
    citation: clamp(100 - penalties.citation),
    reference: clamp(100 - penalties.reference),
    compliance: clamp(100 - penalties.compliance),
    clarity: clamp(100 - penalties.clarity),
  };

  const overall = clamp(
    (dims.structure +
      dims.academic +
      dims.citation +
      dims.reference +
      dims.compliance +
      dims.clarity) /
      6,
  );

  return { ...dims, overall };
}
