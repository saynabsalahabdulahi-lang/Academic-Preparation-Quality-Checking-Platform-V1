import { describe, it, expect } from "vitest";
import { buildChunks } from "@/lib/analysis/service";

const section = (text: string, type = "PARAGRAPH", heading: string | null = null) => ({
  type,
  heading,
  text,
});

describe("buildChunks", () => {
  it("keeps a short document in a single chunk", () => {
    const { chunks, truncated } = buildChunks([
      section("Short paragraph one."),
      section("Short paragraph two."),
    ]);
    expect(chunks).toHaveLength(1);
    expect(truncated).toBe(false);
    expect(chunks[0]).toContain("paragraph one");
    expect(chunks[0]).toContain("paragraph two");
  });

  it("splits a long document into multiple bounded chunks", () => {
    const sections = Array.from({ length: 20 }, (_, i) =>
      section(`Paragraph ${i} `.repeat(60)),
    );
    const { chunks } = buildChunks(sections, 2000, 8);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Each chunk stays near the limit (a single oversized section may exceed).
      expect(chunk.length).toBeLessThan(4000);
    }
  });

  it("flags truncation when the document exceeds the chunk budget", () => {
    const sections = Array.from({ length: 40 }, (_, i) =>
      section(`Paragraph ${i} `.repeat(60)),
    );
    const { chunks, truncated } = buildChunks(sections, 1000, 3);
    expect(chunks).toHaveLength(3);
    expect(truncated).toBe(true);
  });

  it("includes headings as markers", () => {
    const { chunks } = buildChunks([section("Introduction", "HEADING", "Introduction")]);
    expect(chunks[0]).toContain("## Introduction");
  });
});
