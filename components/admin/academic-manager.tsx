"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Program = {
  id: string;
  name: string;
  degreeLevel: string | null;
  guidelineCount: number;
};
type Department = { id: string; name: string; programs: Program[] };
type College = { id: string; name: string; departments: Department[] };
type University = {
  id: string;
  name: string;
  country: string | null;
  colleges: College[];
};

type Level = "university" | "college" | "department" | "program";

export function AcademicManager({
  universities,
}: {
  universities: University[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(level: Level, fields: Record<string, string>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/academic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, ...fields }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove(level: Level, id: string, label: string) {
    if (
      !window.confirm(
        `Delete “${label}”? Everything inside it will also be removed.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/admin/academic?level=${level}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <AddForm
        title="Add a university"
        fields={[
          { name: "name", label: "University name", required: true },
          { name: "country", label: "Country (optional)" },
        ]}
        busy={busy}
        onSubmit={(values) => create("university", values)}
      />

      {universities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          No universities yet. Add your first one above.
        </p>
      ) : (
        universities.map((u) => (
          <section
            key={u.id}
            className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
          >
            <Header
              title={u.name}
              subtitle={u.country ?? undefined}
              onDelete={() => remove("university", u.id, u.name)}
              busy={busy}
            />

            <div className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
              {u.colleges.map((c) => (
                <div key={c.id}>
                  <Header
                    title={c.name}
                    small
                    onDelete={() => remove("college", c.id, c.name)}
                    busy={busy}
                  />

                  <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
                    {c.departments.map((d) => (
                      <div key={d.id}>
                        <Header
                          title={d.name}
                          small
                          onDelete={() => remove("department", d.id, d.name)}
                          busy={busy}
                        />

                        <ul className="mt-2 space-y-2 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
                          {d.programs.map((p) => (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2"
                            >
                              <span className="text-sm">
                                {p.name}
                                {p.degreeLevel && (
                                  <span className="text-slate-500">
                                    {" "}
                                    ({p.degreeLevel})
                                  </span>
                                )}
                                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {p.guidelineCount} guideline
                                  {p.guidelineCount === 1 ? "" : "s"}
                                </span>
                              </span>
                              <span className="flex gap-2">
                                <Link
                                  href={`/admin/programs/${p.id}`}
                                  className="rounded-lg border border-brand-600 px-3 py-1 text-xs font-medium text-brand-700"
                                >
                                  Set guidelines
                                </Link>
                                <DeleteButton
                                  busy={busy}
                                  onClick={() =>
                                    remove("program", p.id, p.name)
                                  }
                                />
                              </span>
                            </li>
                          ))}
                        </ul>

                        <AddForm
                          title="Add a program"
                          compact
                          fields={[
                            { name: "name", label: "Program", required: true },
                            { name: "degreeLevel", label: "Level (e.g. Masters)" },
                          ]}
                          busy={busy}
                          onSubmit={(values) =>
                            create("program", { ...values, parentId: d.id })
                          }
                        />
                      </div>
                    ))}

                    <AddForm
                      title="Add a department"
                      compact
                      fields={[
                        { name: "name", label: "Department", required: true },
                      ]}
                      busy={busy}
                      onSubmit={(values) =>
                        create("department", { ...values, parentId: c.id })
                      }
                    />
                  </div>
                </div>
              ))}

              <AddForm
                title="Add a college"
                compact
                fields={[{ name: "name", label: "College", required: true }]}
                busy={busy}
                onSubmit={(values) =>
                  create("college", { ...values, parentId: u.id })
                }
              />
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Header({
  title,
  subtitle,
  small,
  onDelete,
  busy,
}: {
  title: string;
  subtitle?: string;
  small?: boolean;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className={small ? "font-medium" : "text-lg font-semibold"}>
        {title}
        {subtitle && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            {subtitle}
          </span>
        )}
      </h3>
      <DeleteButton busy={busy} onClick={onDelete} />
    </div>
  );
}

function DeleteButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
    >
      Delete
    </button>
  );
}

function AddForm({
  title,
  fields,
  onSubmit,
  busy,
  compact,
}: {
  title: string;
  fields: { name: string; label: string; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => Promise<boolean>;
  busy: boolean;
  compact?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await onSubmit(values);
    if (ok) setValues({});
  }

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "flex flex-wrap items-end gap-2 pt-1"
          : "flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
      }
    >
      {!compact && (
        <span className="w-full text-sm font-medium">{title}</span>
      )}
      {fields.map((f) => (
        <label key={f.name} className="flex-1">
          <span className="sr-only">{f.label}</span>
          <input
            type="text"
            required={f.required}
            placeholder={f.label}
            value={values[f.name] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.name]: e.target.value }))
            }
            className="w-full min-w-[8rem] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {compact ? "Add" : title}
      </button>
    </form>
  );
}
