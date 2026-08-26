import { z } from "zod";

// Zod schemas validate EVERY AI response before it is used. Never trust raw
// model output. Keep these aligned with the Prisma enums.

const ISSUE_CATEGORIES = [
  "GRAMMAR",
  "SPELLING",
  "CLARITY",
  "ACADEMIC_TONE",
  "REPETITION",
  "PARAGRAPH_STRUCTURE",
  "LOGICAL_FLOW",
  "SECTION_STRUCTURE",
  "CITATION_CONSISTENCY",
  "REFERENCE_CONSISTENCY",
  "GUIDELINE_COMPLIANCE",
  "COMPLETENESS",
  "TERMINOLOGY_CONSISTENCY",
] as const;

const SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "SUGGESTION",
] as const;

/** Common shorthands the model may use instead of the exact enum name. */
const CATEGORY_ALIASES: Record<string, (typeof ISSUE_CATEGORIES)[number]> = {
  TONE: "ACADEMIC_TONE",
  ACADEMIC_STYLE: "ACADEMIC_TONE",
  STYLE: "ACADEMIC_TONE",
  WORDINESS: "CLARITY",
  CONCISENESS: "CLARITY",
  READABILITY: "CLARITY",
  PUNCTUATION: "GRAMMAR",
  SYNTAX: "GRAMMAR",
  TYPO: "SPELLING",
  FLOW: "LOGICAL_FLOW",
  COHERENCE: "LOGICAL_FLOW",
  TRANSITIONS: "LOGICAL_FLOW",
  STRUCTURE: "SECTION_STRUCTURE",
  ORGANIZATION: "SECTION_STRUCTURE",
  PARAGRAPHING: "PARAGRAPH_STRUCTURE",
  CITATION: "CITATION_CONSISTENCY",
  CITATIONS: "CITATION_CONSISTENCY",
  REFERENCE: "REFERENCE_CONSISTENCY",
  REFERENCES: "REFERENCE_CONSISTENCY",
  REFERENCING: "REFERENCE_CONSISTENCY",
  GUIDELINE: "GUIDELINE_COMPLIANCE",
  COMPLIANCE: "GUIDELINE_COMPLIANCE",
  FORMATTING: "GUIDELINE_COMPLIANCE",
  TERMINOLOGY: "TERMINOLOGY_CONSISTENCY",
  CONSISTENCY: "TERMINOLOGY_CONSISTENCY",
};

const SEVERITY_ALIASES: Record<string, (typeof SEVERITIES)[number]> = {
  MAJOR: "HIGH",
  MODERATE: "MEDIUM",
  MINOR: "LOW",
  INFO: "SUGGESTION",
  SUGGESTIONS: "SUGGESTION",
  NIT: "SUGGESTION",
};

/** Normalize free-form model output (`"academic tone"`) to an enum member. */
function normalizeToken(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z_]/g, "");
}

// The model does not reliably echo the exact casing or spelling of the enum,
// so normalize first and fall back to a safe default rather than discarding an
// otherwise useful finding.
export const issueCategorySchema = z.preprocess((value) => {
  const token = normalizeToken(value);
  if ((ISSUE_CATEGORIES as readonly string[]).includes(token)) return token;
  return CATEGORY_ALIASES[token] ?? "CLARITY";
}, z.enum(ISSUE_CATEGORIES));

export const severitySchema = z.preprocess((value) => {
  const token = normalizeToken(value);
  if ((SEVERITIES as readonly string[]).includes(token)) return token;
  return SEVERITY_ALIASES[token] ?? "MEDIUM";
}, z.enum(SEVERITIES));

export const aiIssueSchema = z.object({
  category: issueCategorySchema,
  severity: severitySchema,
  location: z.string().optional(),
  original_text: z.string().optional(),
  explanation: z
    .string()
    .min(1)
    .catch("This passage was flagged for review."),
  suggested_action: z.string().optional(),
  suggested_revision: z.string().optional(),
});

export const analyzeResponseSchema = z.object({
  issues: z.array(aiIssueSchema),
});

export const rewriteResponseSchema = z.object({
  original_text: z.string(),
  revised_text: z.string(),
  what_changed: z.string().optional(),
  why_changed: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).default([]),
});

export const checkRevisionResponseSchema = z.object({
  meaning_preserved: z.boolean(),
  warnings: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type AIIssue = z.infer<typeof aiIssueSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;
export type CheckRevisionResponse = z.infer<typeof checkRevisionResponseSchema>;
