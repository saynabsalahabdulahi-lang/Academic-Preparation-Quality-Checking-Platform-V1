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
// Sonnet balances analysis quality against cost per document; set
// ANTHROPIC_MODEL to override (e.g. claude-opus-5 for the deepest feedback,
// claude-haiku-4-5 for the cheapest).
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

// Generous enough that structured responses are never truncated mid-JSON.
const MAX_TOKENS = 16000;

export class AIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIResponseError";
  }
}

/**
 * Rebuild `{"issues":[...]}` from a response that was cut off mid-array by
 * keeping only the complete objects. Returns null when nothing is salvageable.
 */
function salvageIssues(text: string): unknown | null {
  const arrayStart = text.indexOf("[", text.indexOf('"issues"'));
  if (arrayStart === -1) return null;

  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (objects.length === 0) return null;
  try {
    return JSON.parse(`{"issues":[${objects.join(",")}]}`);
  } catch {
    return null;
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
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through to salvage
      }
    }
    const salvaged = salvageIssues(trimmed);
    if (salvaged) return salvaged;
    throw new AIResponseError("No usable JSON found in AI response");
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

  private async complete(
    system: string,
    prompt: string,
    effort: "low" | "medium" = "low",
  ): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      // Keep latency predictable: these routes run inside a serverless request.
      output_config: { effort },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    if (!text) throw new AIResponseError("AI response contained no text");
    return text;
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
    effort: "low" | "medium" = "low",
  ): Promise<z.infer<S>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.complete(system, prompt, effort);
        return schema.parse(extractJson(raw));
      } catch (err) {
        // Only a malformed or invalid *response* is worth asking again for.
        // Re-sending after an API error (bad key, exhausted credit, invalid
        // request) cannot succeed and would be billed a second time.
        if (err instanceof Anthropic.APIError) throw err;
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
      "medium",
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
