"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategoryOption = { value: string; label: string };

export function UploadForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/documents", { method: "POST", body: form });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed.");
      setPending(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/documents/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Chapter 3 — Methodology"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Document type</span>
        <select
          name="category"
          required
          defaultValue=""
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="" disabled>
            Choose a type…
          </option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Word document</span>
        <input
          name="file"
          type="file"
          required
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700 dark:text-slate-300"
        />
        <span className="mt-1 block text-xs text-slate-500">
          .docx only, up to 15 MB.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload & analyze"}
      </button>
    </form>
  );
}
