import JSZip from "jszip";

/**
 * Secure upload validation.
 *
 * We never trust the client-provided filename or MIME type alone. A .docx is
 * a ZIP (OOXML) archive, so we verify:
 *   1. size within limit,
 *   2. extension is .docx,
 *   3. the bytes start with the ZIP local-file-header magic (PK\x03\x04),
 *   4. the archive actually contains `word/document.xml` (i.e. it really is a
 *      Word document, not just any zip renamed to .docx).
 */

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DEFAULT_MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024,
);

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

// ZIP local file header signature: 0x50 0x4B 0x03 0x04 ("PK\x03\x04").
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function hasZipMagic(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  return ZIP_MAGIC.every((b, i) => buf[i] === b);
}

export function validateFilename(filename: string): ValidationResult {
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".docx")) {
    return { ok: false, error: "Only .docx Word documents are supported." };
  }
  return { ok: true };
}

export function validateSize(
  sizeBytes: number,
  max = DEFAULT_MAX_UPLOAD_BYTES,
): ValidationResult {
  if (sizeBytes <= 0) return { ok: false, error: "The file is empty." };
  if (sizeBytes > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { ok: false, error: `File exceeds the ${mb} MB limit.` };
  }
  return { ok: true };
}

/**
 * Full validation of the uploaded bytes. Confirms the file is genuinely a
 * Word document by opening the archive and checking for the main document part.
 */
export async function validateDocx(
  buffer: Uint8Array,
  filename: string,
  max = DEFAULT_MAX_UPLOAD_BYTES,
): Promise<ValidationResult> {
  const name = validateFilename(filename);
  if (!name.ok) return name;

  const size = validateSize(buffer.byteLength, max);
  if (!size.ok) return size;

  if (!hasZipMagic(buffer)) {
    return { ok: false, error: "The file is not a valid Word document." };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file("word/document.xml")) {
      return {
        ok: false,
        error: "The file does not appear to be a valid Word (.docx) document.",
      };
    }
  } catch {
    return { ok: false, error: "The file could not be read as a .docx." };
  }

  return { ok: true };
}
