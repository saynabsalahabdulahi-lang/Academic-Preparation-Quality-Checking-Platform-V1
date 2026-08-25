"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VersionRow = {
  id: string;
  versionNumber: number;
  label: string | null;
  isCurrent: boolean;
  createdAt: string;
};

export function VersionHistory({
  documentId,
  versions,
}: {
  documentId: string;
  versions: VersionRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(versionId: string) {
    setBusy(versionId);
    const res = await fetch(
      `/api/documents/${documentId}/versions/${versionId}/restore`,
      { method: "POST" },
    );
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {versions.map((v) => (
        <li key={v.id} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm">
            <span className="font-medium">Version {v.versionNumber}</span>
            {v.label && (
              <span className="ml-2 text-slate-500">{v.label}</span>
            )}
          </span>
          {v.isCurrent ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              Current
            </span>
          ) : (
            <button
              onClick={() => restore(v.id)}
              disabled={busy === v.id}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {busy === v.id ? "Restoring…" : "Restore"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
