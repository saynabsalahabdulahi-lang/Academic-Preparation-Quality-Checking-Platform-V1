import { describe, it, expect } from "vitest";

import { buildDocx } from "@/lib/docx/export";
import { extractDocx } from "@/lib/docx/parse";

describe("DOCX export", () => {
  it("produces a valid .docx that round-trips through extraction", async () => {
    const sections = [
      { type: "HEADING", heading: "Introduction", text: "Introduction" },
      { type: "PARAGRAPH", heading: null, text: "This is the revised body." },
      { type: "LIST", heading: null, text: "A single bullet" },
    ];

    const buffer = await buildDocx(sections);

    // Valid ZIP/OOXML: starts with PK.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const extracted = await extractDocx(buffer);
    const texts = extracted.sections.map((s) => s.text);
    expect(texts).toContain("Introduction");
    expect(texts.some((t) => t.includes("revised body"))).toBe(true);
    expect(texts).toContain("A single bullet");
  });

  it("handles an empty section list without throwing", async () => {
    const buffer = await buildDocx([]);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
