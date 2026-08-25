import { describe, it, expect } from "vitest";

import { extractDocx } from "@/lib/docx/parse";
import { makeDocx, SAMPLE_BODY } from "./helpers/docx";

describe("DOCX extraction", () => {
  it("extracts ordered, typed sections", async () => {
    const buf = await makeDocx(SAMPLE_BODY);
    const { sections, wordCount } = await extractDocx(buf);

    const types = sections.map((s) => s.type);
    expect(types).toEqual(["HEADING", "PARAGRAPH", "LIST", "TABLE"]);

    const heading = sections[0];
    expect(heading.heading).toBe("Introduction");
    expect(heading.headingLevel).toBe(1);

    expect(sections[1].text).toContain("climate adaptation");
    expect(sections[2].text).toBe("First point");

    // Table text preserves rows/cells.
    expect(sections[3].text).toContain("Region | Rainfall");
    expect(sections[3].text).toContain("North | 420mm");

    expect(wordCount).toBeGreaterThan(0);
  });

  it("preserves document order", async () => {
    const buf = await makeDocx(SAMPLE_BODY);
    const { sections } = await extractDocx(buf);
    const orders = sections.map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("reports a warning for an empty document", async () => {
    const buf = await makeDocx("");
    const { sections, warnings } = await extractDocx(buf);
    expect(sections).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("throws on a docx missing the body", async () => {
    // A zip with a malformed document.xml (no body) should fail extraction.
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      '<?xml version="1.0"?><w:document xmlns:w="http://x"></w:document>',
    );
    const buf = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
    await expect(extractDocx(buf)).rejects.toThrow();
  });
});
