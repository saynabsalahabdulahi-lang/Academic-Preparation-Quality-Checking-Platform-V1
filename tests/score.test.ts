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

  it("reports compliance as not checked when no guideline applied", () => {
    const s = computeScores([], 0, { guidelineApplied: false });
    expect(s.compliance).toBeNull();
    // Overall averages only the dimensions that were actually checked.
    expect(s.overall).toBe(100);
  });

  it("excludes unchecked compliance from the overall average", () => {
    const withGuideline = computeScores(
      [{ category: "CLARITY", severity: "CRITICAL" }],
      0,
      { guidelineApplied: true },
    );
    const without = computeScores(
      [{ category: "CLARITY", severity: "CRITICAL" }],
      0,
      { guidelineApplied: false },
    );
    // 5 checked dimensions instead of 6 -> the same penalty weighs more.
    expect(without.overall).toBeLessThan(withGuideline.overall);
  });
});

describe("length-proportional scoring", () => {
  const manyIssues = Array.from({ length: 30 }, () => ({
    category: "SECTION_STRUCTURE" as const,
    severity: "MEDIUM" as const,
  }));

  it("does not zero out a long document for having more issues", () => {
    // Same 30 issues, but spread over an 8,000-word article.
    const long = computeScores(manyIssues, 8000);
    expect(long.structure).toBeGreaterThan(0);
    expect(long.overall).toBeGreaterThan(50);
  });

  it("still penalizes a short document with the same issue count", () => {
    const short = computeScores(manyIssues, 500);
    const long = computeScores(manyIssues, 8000);
    expect(short.structure).toBeLessThan(long.structure);
  });

  it("scores a clean document 100 regardless of length", () => {
    expect(computeScores([], 20000).overall).toBe(100);
  });

  it("is unchanged when no word count is supplied", () => {
    expect(computeScores([{ category: "CLARITY", severity: "CRITICAL" }]).clarity).toBe(75);
  });
});
