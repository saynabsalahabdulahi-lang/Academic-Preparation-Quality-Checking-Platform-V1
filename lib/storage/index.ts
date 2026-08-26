import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Object storage abstraction. Files live in object storage (Vercel Blob in
 * production); the database only ever stores metadata + the returned
 * `storageKey`. The blob key/URL is never exposed to the client — downloads go
 * through an owner-checked route that streams via `get()`.
 */
export interface Storage {
  put(
    key: string,
    data: Uint8Array,
    contentType?: string,
  ): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
}

/** Generate an unguessable storage key. Never derived from the client name. */
export function generateStorageKey(prefix = "documents"): string {
  return `${prefix}/${randomUUID()}.docx`;
}

// --- Vercel Blob implementation -------------------------------------------

/**
 * Vercel Blob. The store may be created as private (recommended: the file is
 * never reachable by URL) or public, so each operation tries private first and
 * falls back to public. We persist the pathname — not a URL — as the
 * storageKey, so nothing user-facing ever exposes a blob location.
 */
class VercelBlobStorage implements Storage {
  async put(key: string, data: Uint8Array, contentType?: string) {
    const { put } = await import("@vercel/blob");
    const body = Buffer.from(data);
    const base = {
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    } as const;

    try {
      await put(key, body, { ...base, access: "private" });
    } catch {
      await put(key, body, { ...base, access: "public" });
    }
    return { storageKey: key };
  }

  async get(storageKey: string): Promise<Uint8Array> {
    const { get } = await import("@vercel/blob");

    let result = await get(storageKey, { access: "private" }).catch(() => null);
    if (!result) {
      result = await get(storageKey, { access: "public" }).catch(() => null);
    }
    if (!result) throw new Error("Stored file could not be read.");

    const chunks: Uint8Array[] = [];
    // @ts-expect-error - web stream is async-iterable at runtime on Node 18+
    for await (const chunk of result.stream) {
      chunks.push(chunk as Uint8Array);
    }
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  async delete(storageKey: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(storageKey);
  }
}

// --- Local filesystem implementation (dev/test fallback) ------------------

class LocalStorage implements Storage {
  private base = resolve(process.env.LOCAL_STORAGE_DIR ?? ".storage");

  private pathFor(key: string) {
    return join(this.base, key);
  }

  async put(key: string, data: Uint8Array) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { storageKey: key };
  }

  async get(storageKey: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.pathFor(storageKey)));
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(this.pathFor(storageKey)).catch(() => {});
  }
}

let cached: Storage | null = null;

export function getStorage(): Storage {
  if (!cached) {
    cached = process.env.BLOB_READ_WRITE_TOKEN
      ? new VercelBlobStorage()
      : new LocalStorage();
  }
  return cached;
}
