"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnalyzeButton({
  documentId,
  hasAnalysis,
}: {
  documentId: string;
  hasAnalysis: boolean;
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
      setError(data.error ?? "Analysis failed.");
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
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
