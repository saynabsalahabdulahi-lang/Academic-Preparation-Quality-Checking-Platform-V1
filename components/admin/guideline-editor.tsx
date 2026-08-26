"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Guideline = {
  id: string;
  category: string | null;
  citationStyle: string | null;
  referenceStyle: string | null;
  fontFamily: string | null;
  fontSizePt: number | null;
  lineSpacing: number | null;
  marginsCm: number | null;
  minWords: number | null;
  maxWords: number | null;
  requiredSections: string[];
  prohibitedFormatting: string[];
};

type CategoryOption = { value: string; label: string };

const EMPTY: Omit<Guideline, "id"> = {
  category: null,
  citationStyle: null,
  referenceStyle: null,
  fontFamily: null,
  fontSizePt: null,
  lineSpacing: null,
  marginsCm: null,
  minWords: null,
  maxWords: null,
  requiredSections: [],
  prohibitedFormatting: [],
};

export function GuidelineEditor({
  programId,
  categories,
  guidelines,
}: {
  programId: string;
  categories: CategoryOption[];
  guidelines: Guideline[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadExisting(value: string) {
    setCategory(value);
    setMessage(null);
    setError(null);
    const existing = guidelines.find((g) => (g.category ?? "") === value);
    setForm(existing ? { ...existing } : EMPTY);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/guidelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programId,
        category: category || undefined,
        citationStyle: form.citationStyle ?? "",
        referenceStyle: form.referenceStyle ?? "",
        fontFamily: form.fontFamily ?? "",
        fontSizePt: form.fontSizePt ?? "",
        lineSpacing: form.lineSpacing ?? "",
        marginsCm: form.marginsCm ?? "",
        minWords: form.minWords ?? "",
        maxWords: form.maxWords ?? "",
        requiredSections: form.requiredSections.join("\n"),
        prohibitedFormatting: form.prohibitedFormatting.join("\n"),
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
      return;
    }
    setMessage("Guidelines saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Which document type do these rules apply to?
          </span>
          <select
            value={category}
            onChange={(e) => loadExisting(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All document types</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {guidelines.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Saved so far:{" "}
            {guidelines
              .map((g) =>
                g.category
                  ? (categories.find((c) => c.value === g.category)?.label ??
                    g.category)
                  : "All document types",
              )
              .join(", ")}
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2 dark:border-slate-800">
        <Text
          label="Citation style"
          placeholder="e.g. APA 7"
          value={form.citationStyle}
          onChange={(v) => set("citationStyle", v)}
        />
        <Text
          label="Reference style"
          placeholder="e.g. APA 7"
          value={form.referenceStyle}
          onChange={(v) => set("referenceStyle", v)}
        />
        <Text
          label="Font"
          placeholder="e.g. Times New Roman"
          value={form.fontFamily}
          onChange={(v) => set("fontFamily", v)}
        />
        <Num
          label="Font size (pt)"
          value={form.fontSizePt}
          onChange={(v) => set("fontSizePt", v)}
        />
        <Num
          label="Line spacing"
          value={form.lineSpacing}
          onChange={(v) => set("lineSpacing", v)}
        />
        <Num
          label="Margins (cm)"
          value={form.marginsCm}
          onChange={(v) => set("marginsCm", v)}
        />
        <Num
          label="Minimum words"
          value={form.minWords}
          onChange={(v) => set("minWords", v)}
        />
        <Num
          label="Maximum words"
          value={form.maxWords}
          onChange={(v) => set("maxWords", v)}
        />
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2 dark:border-slate-800">
        <Lines
          label="Required sections"
          hint="One per line, in order"
          value={form.requiredSections}
          onChange={(v) => set("requiredSections", v)}
        />
        <Lines
          label="Not allowed"
          hint="One per line"
          value={form.prohibitedFormatting}
          onChange={(v) => set("prohibitedFormatting", v)}
        />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save guidelines"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900";

function Text({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={inputClass}
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="number"
        step="any"
        min={0}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={inputClass}
      />
    </label>
  );
}

function Lines({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea
        rows={6}
        placeholder={hint}
        value={value.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((s) => s.trimStart())
              .filter((s, i, arr) => s !== "" || i === arr.length - 1),
          )
        }
        className={inputClass}
      />
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
    </label>
  );
}
