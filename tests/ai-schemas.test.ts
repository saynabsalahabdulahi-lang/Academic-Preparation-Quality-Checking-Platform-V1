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

  it("normalizes lowercase categories and severities from the model", () => {
    const parsed = analyzeResponseSchema.parse({
      issues: [
        { category: "spelling", severity: "medium", explanation: "typo" },
        { category: "academic tone", severity: "minor", explanation: "informal" },
      ],
    });
    expect(parsed.issues[0].category).toBe("SPELLING");
    expect(parsed.issues[0].severity).toBe("MEDIUM");
    expect(parsed.issues[1].category).toBe("ACADEMIC_TONE");
    expect(parsed.issues[1].severity).toBe("LOW");
  });

  it("maps common shorthand categories to the closest enum member", () => {
    const parsed = analyzeResponseSchema.parse({
      issues: [
        { category: "citations", severity: "HIGH", explanation: "missing" },
        { category: "flow", severity: "HIGH", explanation: "abrupt" },
      ],
    });
    expect(parsed.issues[0].category).toBe("CITATION_CONSISTENCY");
    expect(parsed.issues[1].category).toBe("LOGICAL_FLOW");
  });

  it("falls back to a safe default for an unrecognised category", () => {
    const parsed = analyzeResponseSchema.parse({
      issues: [{ category: "NONSENSE", severity: "WEIRD", explanation: "x" }],
    });
    expect(parsed.issues[0].category).toBe("CLARITY");
    expect(parsed.issues[0].severity).toBe("MEDIUM");
  });

  it("defaults warnings to an empty array on rewrite responses", () => {
    const parsed = rewriteResponseSchema.parse({
      original_text: "a",
      revised_text: "b",
    });
    expect(parsed.warnings).toEqual([]);
  });
});
