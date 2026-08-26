/**
 * Centralized, versioned prompts.
 *
 * Keep ALL prompt text here rather than scattered across the codebase. Bump
 * PROMPT_VERSION when prompts change so analysis runs can be traced back to the
 * prompt that produced them (stored in Check.metadata).
 */

export const PROMPT_VERSION = "2026-08-25.3";

// Shared guardrails injected into every rewrite/analysis prompt. These enforce
// the product's integrity constraints (see MASTER PROMPT sections 9 & 20).
export const INTEGRITY_GUARDRAILS = `
Hard rules you must never break:
- Preserve factual meaning, research findings, numbers, dates, citations,
  references, quotations, technical terminology, and methodological details.
- Never invent research findings, citations, or references.
- Never change numerical results unless explicitly instructed.
- You are helping a student improve THEIR OWN writing. You are NOT a tool to
  evade plagiarism detection, AI detection, or academic-integrity policies.
- Respond ONLY with valid JSON matching the requested schema. No prose,
  no markdown fences.
`.trim();

export const SYSTEM_ANALYZE = `
You are an academic writing quality checker for graduate students. You identify
concrete, actionable problems in a student's document and explain why each is a
problem so the student can fix it themselves.
${INTEGRITY_GUARDRAILS}
`.trim();

export const SYSTEM_REWRITE = `
You revise a passage of a student's academic writing to address a specific
improvement goal, while preserving the student's meaning and evidence.
${INTEGRITY_GUARDRAILS}
`.trim();

export function analyzePrompt(input: {
  text: string;
  documentCategory: string;
  guideline?: unknown;
  part?: number;
  totalParts?: number;
}): string {
  const isExcerpt = (input.totalParts ?? 1) > 1;

  return [
    `Document type: ${input.documentCategory}`,
    isExcerpt
      ? [
          `IMPORTANT: the text below is EXCERPT ${input.part} of ${input.totalParts}`,
          "from a longer document. You are seeing only this portion. Judge only",
          "the text shown, and do NOT report that sections are missing, that the",
          "reference list is absent, or that the text starts or ends abruptly —",
          "those are artefacts of the excerpt boundary, not faults in the",
          "student's document.",
        ].join(" ")
      : "",
    input.guideline
      ? `Applicable guideline context (JSON): ${JSON.stringify(input.guideline)}`
      : "No specific university guideline provided.",
    "",
    "Analyze the document below and return a JSON object of the form:",
    `{"issues":[{"category":"...","severity":"...","location":"...","original_text":"...","explanation":"...","suggested_action":"...","suggested_revision":"..."}]}`,
    "Use these exact UPPERCASE values.",
    "category: GRAMMAR, SPELLING, CLARITY, ACADEMIC_TONE, REPETITION,",
    "PARAGRAPH_STRUCTURE, LOGICAL_FLOW, SECTION_STRUCTURE,",
    "CITATION_CONSISTENCY, REFERENCE_CONSISTENCY, GUIDELINE_COMPLIANCE,",
    "COMPLETENESS, TERMINOLOGY_CONSISTENCY.",
    "severity: CRITICAL, HIGH, MEDIUM, LOW, SUGGESTION.",
    "Report at most 15 of the most important issues.",
    "",
    "DOCUMENT:",
    input.text,
  ]
    .filter(Boolean)
    .join("\n");
}

export function rewritePrompt(input: {
  text: string;
  action: string;
  previousRevision?: string;
  styleGuidance?: string;
}): string {
  return [
    `Improvement goal: ${input.action}`,
    input.styleGuidance
      ? `Match this writing-style guidance: ${input.styleGuidance}`
      : "",
    input.previousRevision
      ? `A previous revision the student was not satisfied with:\n${input.previousRevision}`
      : "",
    "",
    "Return a JSON object of the form:",
    `{"original_text":"...","revised_text":"...","what_changed":"...","why_changed":"...","confidence":0.0,"warnings":[]}`,
    "",
    "PASSAGE TO REVISE:",
    input.text,
  ]
    .filter(Boolean)
    .join("\n");
}
