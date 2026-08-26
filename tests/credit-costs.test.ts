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
