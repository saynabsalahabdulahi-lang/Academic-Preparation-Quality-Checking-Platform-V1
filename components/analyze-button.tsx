"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnalyzeButton({
  documentId,
  hasAnalysis,
  creditCost,
  unlimited,
}: {
  documentId: string;
  hasAnalysis: boolean;
  creditCost: number;
  unlimited: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/analyze`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Analysis failed (${res.status}).`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending
          ? "Analyzing…"
          : hasAnalysis
            ? "Check again"
            : "Run analysis"}
      </button>
      {!pending && (
        <span className="text-sm text-slate-500">
          {unlimited
            ? "No credits used"
            : `Uses ${creditCost} credit${creditCost === 1 ? "" : "s"}`}
        </span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
