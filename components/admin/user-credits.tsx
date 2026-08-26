"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  creditBalance: number;
  documentCount: number;
};

export function UserCredits({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grant(userId: string, amount: number) {
    setBusyId(userId);
    setError(null);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update credits.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {u.name ?? u.email}
                {u.role === "ADMIN" && (
                  <span className="ml-2 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    admin
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {u.email} · {u.documentCount} document
                {u.documentCount === 1 ? "" : "s"}
              </span>
            </span>

            <span className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium tabular-nums dark:bg-slate-800">
                {u.role === "ADMIN" ? "unlimited" : `${u.creditBalance} credits`}
              </span>
              {u.role !== "ADMIN" && (
                <>
                  <GrantButton
                    label="+10"
                    busy={busyId === u.id}
                    onClick={() => grant(u.id, 10)}
                  />
                  <GrantButton
                    label="+50"
                    busy={busyId === u.id}
                    onClick={() => grant(u.id, 50)}
                  />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GrantButton({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-brand-600 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
