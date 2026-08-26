import type { RevisionAction } from "@prisma/client";
import type {
  AnalyzeResponse,
  RewriteResponse,
  CheckRevisionResponse,
} from "@/lib/ai/schemas";

// Guideline context passed into analysis so checks reflect the selected
// university/program/document type.
export interface GuidelineContext {
  citationStyle?: string | null;
  referenceStyle?: string | null;
  requiredSections?: string[];
  minWords?: number | null;
  maxWords?: number | null;
  documentCategory?: string;
  extraRules?: unknown;
}

export interface AnalyzeInput {
  text: string;
  documentCategory: string;
  guideline?: GuidelineContext;
  /** Position of this excerpt when a document is analysed in several passes. */
  part?: number;
  totalParts?: number;
}

export interface RewriteInput {
  text: string;
  action: RevisionAction;
  // Optional prior attempt, so "Rewrite Again" can build on context.
  previousRevision?: string;
  // Optional writing-style guidance derived from the student's samples.
  styleGuidance?: string;
}

export interface CheckRevisionInput {
  originalText: string;
  revisedText: string;
}

/**
 * Provider-agnostic AI surface. The rest of the app depends only on this
 * interface, so the underlying provider (Anthropic by default) can be swapped
 * without touching business logic.
 *
 * Implementations MUST validate model output against the Zod schemas in
 * `schemas.ts` before returning.
 */
export interface AIProvider {
  analyzeDocument(input: AnalyzeInput): Promise<AnalyzeResponse>;
  analyzeSection(input: AnalyzeInput): Promise<AnalyzeResponse>;
  rewriteText(input: RewriteInput): Promise<RewriteResponse>;
  rewriteAgain(input: RewriteInput): Promise<RewriteResponse>;
  checkRevision(input: CheckRevisionInput): Promise<CheckRevisionResponse>;
  generateExplanation(input: {
    originalText: string;
    revisedText: string;
  }): Promise<string>;
}
