import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

export type ExportSection = {
  type: string;
  heading: string | null;
  text: string;
};

/**
 * Regenerate a .docx from the structured representation. This preserves the
 * document's content, order, headings, lists, and tables, but produces a clean
 * document — some original visual formatting (exact fonts, spacing, styles)
 * may not carry over. Callers should surface a warning to that effect.
 */
export async function buildDocx(sections: ExportSection[]): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  for (const s of sections) {
    switch (s.type) {
      case "HEADING":
        children.push(
          new Paragraph({
            text: s.heading ?? s.text,
            heading: HeadingLevel.HEADING_1,
          }),
        );
        break;
      case "LIST":
        children.push(
          new Paragraph({ text: s.text, bullet: { level: 0 } }),
        );
        break;
      case "TABLE":
        children.push(buildTable(s.text));
        break;
      default:
        children.push(new Paragraph({ children: [new TextRun(s.text)] }));
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// Table text is stored as "cell | cell" per row, rows separated by newlines.
function buildTable(text: string): Table {
  const rows = text
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((cells) => cells.length > 0);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun(cell)] })],
              }),
          ),
        }),
    ),
  });
}
