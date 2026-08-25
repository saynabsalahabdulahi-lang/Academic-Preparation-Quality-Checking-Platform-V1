import { z } from "zod";

// Zod schemas validate EVERY AI response before it is used. Never trust raw
// model output. Keep these aligned with the Prisma enums.

export const issueCategorySchema = z.enum([
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
]);

export const severitySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "SUGGESTION",
]);

export const aiIssueSchema = z.object({
  category: issueCategorySchema,
  severity: severitySchema,
  location: z.string().optional(),
  original_text: z.string().optional(),
  explanation: z.string().min(1),
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
