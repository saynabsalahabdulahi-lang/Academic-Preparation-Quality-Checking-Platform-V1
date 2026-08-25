"use client";

import { useMemo } from "react";
import { diffWords } from "@/lib/diff";

/**
 * Original vs Revised comparison. Left shows the original with removed text
 * struck through; right shows the revised with added text highlighted.
 */
export function DiffView({
  original,
  revised,
}: {
  original: string;
  revised: string;
}) {
  const ops = useMemo(() => diffWords(original, revised), [original, revised]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Pane title="Original">
        {ops
          .filter((o) => o.type !== "insert")
          .map((o, i) =>
            o.type === "delete" ? (
              <span
                key={i}
                className="rounded bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-200"
              >
                {o.text}
              </span>
            ) : (
              <span key={i}>{o.text}</span>
            ),
          )}
      </Pane>
      <Pane title="Revised">
        {ops
          .filter((o) => o.type !== "delete")
          .map((o, i) =>
            o.type === "insert" ? (
              <span
                key={i}
                className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                {o.text}
              </span>
            ) : (
              <span key={i}>{o.text}</span>
            ),
          )}
      </Pane>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
    </div>
  );
}
