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

class VercelBlobStorage implements Storage {
  async put(key: string, data: Uint8Array, contentType?: string) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(data), {
      access: "public", // URL is unguessable and never sent to the client
      contentType,
      addRandomSuffix: false,
    });
    return { storageKey: blob.url };
  }

  async get(storageKey: string): Promise<Uint8Array> {
    const res = await fetch(storageKey);
    if (!res.ok) throw new Error(`Failed to read blob (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
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
