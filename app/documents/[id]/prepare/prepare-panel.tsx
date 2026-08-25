"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ACTION_OPTIONS } from "@/lib/revisions/actions";
import { DiffView } from "@/components/diff-view";

export type RevisionData = {
  id: string;
  revisedText: string;
  originalText: string;
  whatChanged: string | null;
  whyChanged: string | null;
  confidence: number | null;
  warnings: string[];
  status: string;
  attempt: number;
};

export type SectionData = {
  id: string;
  type: string;
  heading: string | null;
  text: string;
  revision: RevisionData | null;
};

export function PreparePanel({
  documentId,
  sections: initial,
}: {
  documentId: string;
  sections: SectionData[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const acceptedCount = sections.filter(
    (s) => s.revision?.status === "ACCEPTED" || s.revision?.status === "EDITED",
  ).length;

  function updateSection(sectionId: string, revision: RevisionData | null) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, revision } : s)),
    );
  }

  async function runAction(
    sectionId: string,
    action: string,
    previousRevisionId?: string,
  ) {
    setBusyId(sectionId);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, action, previousRevisionId }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Rewrite failed.");
      return;
    }
    const { revision } = await res.json();
    updateSection(sectionId, revision);
  }

  async function decide(
    sectionId: string,
    revisionId: string,
    status: string,
    editedText?: string,
  ) {
    setBusyId(sectionId);
    setError(null);
    const res = await fetch(`/api/revisions/${revisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, editedText }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    const { revision } = await res.json();
    updateSection(sectionId, revision);
  }

  async function createVersion() {
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create a new version.");
      return;
    }
    router.push(`/documents/${documentId}`);
    router.refresh();
  }

  if (sections.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
        No revisable text sections found.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {acceptedCount} revision{acceptedCount === 1 ? "" : "s"} accepted
        </span>
        <button
          onClick={createVersion}
          disabled={acceptedCount === 0 || creating}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create revised version"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {sections.map((s) => (
        <SectionCard
          key={s.id}
          section={s}
          busy={busyId === s.id}
          onAction={runAction}
          onDecide={decide}
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  busy,
  onAction,
  onDecide,
}: {
  section: SectionData;
  busy: boolean;
  onAction: (sectionId: string, action: string, prevId?: string) => void;
  onDecide: (
    sectionId: string,
    revisionId: string,
    status: string,
    editedText?: string,
  ) => void;
}) {
  const [action, setAction] = useState(ACTION_OPTIONS[0].value);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const rev = section.revision;

  return (
    <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
      {section.heading && (
        <h3 className="mb-2 font-semibold">{section.heading}</h3>
      )}

      {!rev && (
        <>
          <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {section.text}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => onAction(section.id, action)}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "Rewriting…" : "Rewrite"}
            </button>
          </div>
        </>
      )}

      {rev && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={rev.status} />
            {rev.attempt > 1 && (
              <span className="text-xs text-slate-400">
                attempt {rev.attempt}
              </span>
            )}
            {typeof rev.confidence === "number" && (
              <span className="text-xs text-slate-400">
                confidence {Math.round(rev.confidence * 100)}%
              </span>
            )}
          </div>

          <DiffView original={rev.originalText} revised={rev.revisedText} />

          {(rev.whatChanged || rev.whyChanged) && (
            <p className="rounded bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              {rev.whatChanged} {rev.whyChanged ? `— ${rev.whyChanged}` : ""}
            </p>
          )}

          {rev.warnings.length > 0 && (
            <ul className="rounded bg-amber-50 p-2 text-xs text-amber-800">
              {rev.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onDecide(section.id, rev.id, "EDITED", editText);
                    setEditing(false);
                  }}
                  disabled={busy || !editText.trim()}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save edit
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ActionBtn
                onClick={() => onDecide(section.id, rev.id, "ACCEPTED")}
                disabled={busy}
                variant="primary"
              >
                Accept
              </ActionBtn>
              <ActionBtn
                onClick={() => onDecide(section.id, rev.id, "REJECTED")}
                disabled={busy}
              >
                Reject
              </ActionBtn>
              <ActionBtn
                onClick={() => {
                  setEditText(rev.revisedText);
                  setEditing(true);
                }}
                disabled={busy}
              >
                Edit
              </ActionBtn>
              <ActionBtn
                onClick={() => onAction(section.id, "IMPROVE_CLARITY", rev.id)}
                disabled={busy}
              >
                Rewrite again
              </ActionBtn>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-700",
    ACCEPTED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
    EDITED: "bg-sky-100 text-sky-800",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ${styles[status] ?? styles.PENDING}`}
    >
      {status}
    </span>
  );
}
