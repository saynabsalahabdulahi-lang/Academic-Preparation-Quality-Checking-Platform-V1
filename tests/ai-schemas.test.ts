import { describe, it, expect } from "vitest";
import {
  analyzeResponseSchema,
  rewriteResponseSchema,
} from "@/lib/ai/schemas";

describe("AI response validation", () => {
  it("accepts a well-formed analyze response", () => {
    const parsed = analyzeResponseSchema.parse({
      issues: [
        {
          category: "ACADEMIC_TONE",
          severity: "MEDIUM",
          explanation: "Informal wording.",
          suggested_revision: "Consider a more formal phrasing.",
        },
      ],
    });
    expect(parsed.issues).toHaveLength(1);
  });

  it("rejects an analyze response with an invalid category", () => {
    expect(() =>
      analyzeResponseSchema.parse({
        issues: [{ category: "NONSENSE", severity: "MEDIUM", explanation: "x" }],
      }),
    ).toThrow();
  });

  it("defaults warnings to an empty array on rewrite responses", () => {
    const parsed = rewriteResponseSchema.parse({
      original_text: "a",
      revised_text: "b",
    });
    expect(parsed.warnings).toEqual([]);
  });
});
