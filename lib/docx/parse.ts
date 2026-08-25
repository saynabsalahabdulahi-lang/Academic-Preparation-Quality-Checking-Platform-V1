import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * DOCX extraction (Phase 4).
 *
 * Parses `word/document.xml` into an ordered, typed representation of the
 * document. We keep paragraph order and classify each block as a heading,
 * list item, table, or paragraph so downstream analysis can reason about
 * structure and later phases can regenerate a DOCX that preserves it.
 *
 * This intentionally extracts a *representation*; the original file is always
 * kept in storage so nothing is lost.
 */

export type ExtractedSectionType =
  | "HEADING"
  | "PARAGRAPH"
  | "LIST"
  | "TABLE"
  | "OTHER";

export interface ExtractedSection {
  order: number;
  type: ExtractedSectionType;
  heading?: string; // heading text when type === HEADING
  text: string;
  headingLevel?: number;
}

export interface ExtractedDocument {
  sections: ExtractedSection[];
  wordCount: number;
  warnings: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Preserve element order so we don't reorder body content.
  preserveOrder: true,
  trimValues: false,
});

/** Recursively collect all `w:t` text nodes under a preserveOrder subtree. */
function collectText(node: unknown): string {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node !== "object") return "";

  const obj = node as Record<string, unknown>;
  let out = "";
  for (const key of Object.keys(obj)) {
    if (key === "w:t") {
      const t = obj[key];
      if (Array.isArray(t)) {
        for (const item of t) {
          const text = (item as Record<string, unknown>)?.["#text"];
          if (typeof text === "string") out += text;
        }
      }
    } else if (key === "w:tab") {
      out += "\t";
    } else if (!key.startsWith("@_") && key !== "#text" && key !== ":@") {
      out += collectText(obj[key]);
    }
  }
  return out;
}

/**
 * Find the paragraph style value (e.g. "Heading1") within a `w:p` node.
 * In preserveOrder mode, attributes live on a sibling `:@` key of the element.
 */
function paragraphStyle(pChildren: unknown[]): string | null {
  for (const child of pChildren) {
    const obj = child as Record<string, unknown>;
    const pPr = obj["w:pPr"];
    if (Array.isArray(pPr)) {
      for (const prop of pPr) {
        const p = prop as Record<string, unknown>;
        if ("w:pStyle" in p) {
          const attrs = p[":@"] as Record<string, unknown> | undefined;
          const val = attrs?.["@_w:val"];
          if (typeof val === "string") return val;
        }
      }
    }
  }
  return null;
}

/** True if the paragraph carries numbering (i.e. it's a list item). */
function hasNumbering(pChildren: unknown[]): boolean {
  for (const child of pChildren) {
    const pPr = (child as Record<string, unknown>)["w:pPr"];
    if (Array.isArray(pPr)) {
      for (const prop of pPr) {
        if ((prop as Record<string, unknown>)["w:numPr"]) return true;
      }
    }
  }
  return false;
}

function classifyStyle(
  style: string | null,
): { type: ExtractedSectionType; level?: number } {
  if (!style) return { type: "PARAGRAPH" };
  const m = /heading\s*(\d+)?/i.exec(style);
  if (m) {
    return { type: "HEADING", level: m[1] ? Number(m[1]) : 1 };
  }
  if (/^title$/i.test(style)) return { type: "HEADING", level: 1 };
  return { type: "PARAGRAPH" };
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export async function extractDocx(
  buffer: Uint8Array,
): Promise<ExtractedDocument> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid .docx: missing word/document.xml");
  }

  const xml = await docFile.async("string");
  const tree = parser.parse(xml) as unknown[];

  // Locate <w:document> → <w:body>.
  const body = findBody(tree);
  if (!body) {
    throw new Error("Invalid .docx: missing document body");
  }

  const sections: ExtractedSection[] = [];
  let order = 0;

  for (const block of body) {
    const obj = block as Record<string, unknown>;

    if (Array.isArray(obj["w:p"])) {
      const pChildren = obj["w:p"] as unknown[];
      const text = collectText(pChildren).replace(/\s+\n/g, "\n").trim();
      const style = paragraphStyle(pChildren);
      const { type, level } = classifyStyle(style);

      // Skip fully empty paragraphs (spacing) but keep order stable.
      if (!text) continue;

      if (type === "HEADING") {
        sections.push({ order: order++, type, heading: text, text, headingLevel: level });
      } else if (hasNumbering(pChildren)) {
        sections.push({ order: order++, type: "LIST", text });
      } else {
        sections.push({ order: order++, type: "PARAGRAPH", text });
      }
    } else if (Array.isArray(obj["w:tbl"])) {
      const rows = extractTableRows(obj["w:tbl"] as unknown[]);
      const text = rows.map((r) => r.join(" | ")).join("\n");
      sections.push({ order: order++, type: "TABLE", text });
    }
  }

  if (sections.length === 0) {
    warnings.push("No readable text was found in the document.");
  }

  const wordCount = sections.reduce((n, s) => n + countWords(s.text), 0);
  return { sections, wordCount, warnings };
}

function findBody(tree: unknown[]): unknown[] | null {
  for (const node of tree) {
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["w:document"])) {
      for (const child of obj["w:document"] as unknown[]) {
        const c = child as Record<string, unknown>;
        if (Array.isArray(c["w:body"])) return c["w:body"] as unknown[];
      }
    }
  }
  return null;
}

function extractTableRows(tbl: unknown[]): string[][] {
  const rows: string[][] = [];
  for (const node of tbl) {
    const tr = (node as Record<string, unknown>)["w:tr"];
    if (Array.isArray(tr)) {
      const cells: string[] = [];
      for (const cellNode of tr) {
        const tc = (cellNode as Record<string, unknown>)["w:tc"];
        if (Array.isArray(tc)) {
          cells.push(collectText(tc).trim());
        }
      }
      if (cells.length) rows.push(cells);
    }
  }
  return rows;
}
