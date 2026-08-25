import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { validateDocx } from "@/lib/upload/validate";
import { makeDocx, SAMPLE_BODY } from "./helpers/docx";

describe("upload validation", () => {
  it("accepts a genuine .docx", async () => {
    const buf = await makeDocx(SAMPLE_BODY);
    expect(await validateDocx(buf, "thesis.docx")).toEqual({ ok: true });
  });

  it("rejects a non-.docx extension", async () => {
    const buf = await makeDocx(SAMPLE_BODY);
    const res = await validateDocx(buf, "thesis.pdf");
    expect(res.ok).toBe(false);
  });

  it("rejects an empty file", async () => {
    const res = await validateDocx(new Uint8Array(0), "thesis.docx");
    expect(res.ok).toBe(false);
  });

  it("rejects bytes that are not a zip (fake .docx)", async () => {
    const res = await validateDocx(
      new TextEncoder().encode("this is not a docx"),
      "thesis.docx",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a zip that lacks word/document.xml", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "not a word doc");
    const buf = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
    const res = await validateDocx(buf, "thesis.docx");
    expect(res.ok).toBe(false);
  });

  it("rejects a file over the size limit", async () => {
    const buf = await makeDocx(SAMPLE_BODY);
    const res = await validateDocx(buf, "thesis.docx", 10); // 10-byte cap
    expect(res.ok).toBe(false);
  });
});
