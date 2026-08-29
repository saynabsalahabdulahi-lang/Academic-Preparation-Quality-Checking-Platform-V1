import { describe, it, expect } from "vitest";
import { CREDIT_COSTS } from "@/lib/credits/service";

describe("credit pricing", () => {
  it("charges more for an analysis than a rewrite", () => {
    // An analysis reads the whole document in several AI passes; a rewrite
    // touches one section. Equal pricing let re-analysis blow the budget.
    expect(CREDIT_COSTS.ANALYSIS).toBeGreaterThan(CREDIT_COSTS.REWRITE);
  });

  it("uses the documented defaults", () => {
    expect(CREDIT_COSTS.DOCUMENT_UPLOAD).toBe(1);
    expect(CREDIT_COSTS.ANALYSIS).toBe(3);
    expect(CREDIT_COSTS.REWRITE).toBe(1);
  });

  it("never charges for exporting a document", () => {
    expect(CREDIT_COSTS.EXPORT).toBe(0);
  });
});

describe("credit metering switch", () => {
  it("is enabled unless explicitly turned off", async () => {
    const { CREDITS_ENABLED } = await import("@/lib/credits/service");
    // Default posture meters students; CREDITS_ENABLED="false" opts out.
    expect(CREDITS_ENABLED).toBe(true);
  });
});

describe("rewrite actions", () => {
  it("offers a combined action first so one credit covers every improvement", async () => {
    const { ACTION_OPTIONS } = await import("@/lib/revisions/actions");
    expect(ACTION_OPTIONS[0].value).toBe("IMPROVE_ALL");
  });

  it("gives the combined action a prompt covering all improvements", async () => {
    const { rewritePrompt } = await import("@/lib/ai/prompts");
    const prompt = rewritePrompt({ text: "x", action: "IMPROVE_ALL" });
    for (const goal of ["grammar", "clarity", "tone", "flow", "repetition"]) {
      expect(prompt.toLowerCase()).toContain(goal);
    }
  });
});
