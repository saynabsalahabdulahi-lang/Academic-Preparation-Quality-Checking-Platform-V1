import { describe, it, expect } from "vitest";
import { applyRevisionsToSections } from "@/lib/documents/versioning";

const sections = [
  { id: "s1", order: 0, type: "HEADING", heading: "Intro", text: "Intro" },
  { id: "s2", order: 1, type: "PARAGRAPH", heading: null, text: "Old text A." },
  { id: "s3", order: 2, type: "PARAGRAPH", heading: null, text: "Old text B." },
];

describe("applyRevisionsToSections", () => {
  it("replaces only sections with an accepted revision", () => {
    const accepted = new Map([["s2", "New text A."]]);
    const result = applyRevisionsToSections(sections, accepted);
    expect(result.map((s) => s.text)).toEqual([
      "Intro",
      "New text A.",
      "Old text B.",
    ]);
  });

  it("preserves order, type, and heading", () => {
    const result = applyRevisionsToSections(sections, new Map());
    expect(result[0]).toMatchObject({ order: 0, type: "HEADING", heading: "Intro" });
    expect(result.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("carries everything over unchanged when there are no revisions", () => {
    const result = applyRevisionsToSections(sections, new Map());
    expect(result.map((s) => s.text)).toEqual([
      "Intro",
      "Old text A.",
      "Old text B.",
    ]);
  });
});
