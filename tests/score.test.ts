import { describe, it, expect } from "vitest";

import { computeScores } from "@/lib/analysis/score";

describe("Academic Readiness scoring", () => {
  it("returns a perfect score when there are no issues", () => {
    const s = computeScores([]);
    expect(s).toEqual({
      structure: 100,
      academic: 100,
      citation: 100,
      reference: 100,
      compliance: 100,
      clarity: 100,
      overall: 100,
    });
  });

  it("penalizes the correct dimension by severity", () => {
    const s = computeScores([
      { category: "CITATION_CONSISTENCY", severity: "HIGH" }, // -15
    ]);
    expect(s.citation).toBe(85);
    expect(s.structure).toBe(100);
  });

  it("maps academic-writing categories to the academic dimension", () => {
    const s = computeScores([
      { category: "GRAMMAR", severity: "MEDIUM" }, // -8
      { category: "ACADEMIC_TONE", severity: "LOW" }, // -4
    ]);
    expect(s.academic).toBe(88);
  });

  it("clamps a heavily penalized dimension at 0", () => {
    const many = Array.from({ length: 6 }, () => ({
      category: "SECTION_STRUCTURE" as const,
      severity: "CRITICAL" as const, // 6 * 25 = 150 penalty
    }));
    expect(computeScores(many).structure).toBe(0);
  });

  it("computes overall as the rounded average of dimensions", () => {
    const s = computeScores([
      { category: "CLARITY", severity: "CRITICAL" }, // clarity -> 75
    ]);
    // Five dims at 100, clarity at 75 -> (500 + 75) / 6 = 95.83 -> 96
    expect(s.clarity).toBe(75);
    expect(s.overall).toBe(96);
  });
});
