import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type {
  AIProvider,
  AnalyzeInput,
  RewriteInput,
  CheckRevisionInput,
} from "@/lib/ai/provider";
import {
  analyzeResponseSchema,
  rewriteResponseSchema,
  checkRevisionResponseSchema,
  type AnalyzeResponse,
  type RewriteResponse,
  type CheckRevisionResponse,
} from "@/lib/ai/schemas";
import {
  SYSTEM_ANALYZE,
  SYSTEM_REWRITE,
  analyzePrompt,
  rewritePrompt,
} from "@/lib/ai/prompts";

// Configurable via env; model id is intentionally not hard-coded elsewhere.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export class AIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIResponseError";
  }
}

/** Extract the first JSON object/array from a model response string. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to locating the outermost JSON braces.
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start === -1 || end === -1 || end <= start) {
      throw new AIResponseError("No JSON found in AI response");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    this.client = new Anthropic({ apiKey });
    this.model = opts?.model ?? DEFAULT_MODEL;
  }

  private async complete(system: string, prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new AIResponseError("AI response contained no text");
    }
    return block.text;
  }

  /**
   * Complete + parse + validate, with one safe retry on parse/validation
   * failure. Internal errors are wrapped in AIResponseError; callers translate
   * these into user-friendly messages (never expose raw provider errors).
   */
  private async completeValidated<S extends z.ZodTypeAny>(
    system: string,
    prompt: string,
    schema: S,
  ): Promise<z.infer<S>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.complete(system, prompt);
        return schema.parse(extractJson(raw));
      } catch (err) {
        lastError = err;
      }
    }
    throw new AIResponseError(
      `Failed to obtain valid AI response: ${String(lastError)}`,
    );
  }

  analyzeDocument(input: AnalyzeInput): Promise<AnalyzeResponse> {
    return this.completeValidated(
      SYSTEM_ANALYZE,
      analyzePrompt(input),
      analyzeResponseSchema,
    );
  }

  analyzeSection(input: AnalyzeInput): Promise<AnalyzeResponse> {
    // Same contract at section granularity; distinct method so callers/prompts
    // can diverge later without changing the interface.
    return this.analyzeDocument(input);
  }

  rewriteText(input: RewriteInput): Promise<RewriteResponse> {
    return this.completeValidated(
      SYSTEM_REWRITE,
      rewritePrompt(input),
      rewriteResponseSchema,
    );
  }

  rewriteAgain(input: RewriteInput): Promise<RewriteResponse> {
    return this.rewriteText(input);
  }

  checkRevision(input: CheckRevisionInput): Promise<CheckRevisionResponse> {
    const prompt = [
      "Compare the ORIGINAL and REVISED passages. Confirm that meaning,",
      "numbers, citations, references, and findings are preserved. Return JSON:",
      `{"meaning_preserved":true,"warnings":[],"notes":"..."}`,
      "",
      `ORIGINAL:\n${input.originalText}`,
      "",
      `REVISED:\n${input.revisedText}`,
    ].join("\n");
    return this.completeValidated(
      SYSTEM_REWRITE,
      prompt,
      checkRevisionResponseSchema,
    );
  }

  async generateExplanation(input: {
    originalText: string;
    revisedText: string;
  }): Promise<string> {
    const raw = await this.complete(
      SYSTEM_REWRITE,
      [
        "In one or two sentences, explain what changed between the two",
        "passages and why. Plain text only.",
        "",
        `ORIGINAL:\n${input.originalText}`,
        "",
        `REVISED:\n${input.revisedText}`,
      ].join("\n"),
    );
    return raw.trim();
  }
}
