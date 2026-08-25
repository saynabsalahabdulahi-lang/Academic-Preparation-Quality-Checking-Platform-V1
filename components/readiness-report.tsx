import type { IssueSeverity } from "@prisma/client";

type Check = {
  overallScore: number | null;
  structureScore: number | null;
  academicScore: number | null;
  citationScore: number | null;
  referenceScore: number | null;
  complianceScore: number | null;
  clarityScore: number | null;
};

type Issue = {
  id: string;
  category: string;
  severity: IssueSeverity;
  location: string | null;
  explanation: string;
  suggestedRevision: string | null;
};

const SEVERITY_ORDER: IssueSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "SUGGESTION",
];

const SEVERITY_STYLE: Record<IssueSeverity, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-sky-100 text-sky-800",
  SUGGESTION: "bg-slate-100 text-slate-700",
};

function scoreColor(v: number): string {
  if (v >= 80) return "text-emerald-600";
  if (v >= 60) return "text-amber-600";
  return "text-red-600";
}

export function ReadinessReport({
  check,
  issues,
}: {
  check: Check;
  issues: Issue[];
}) {
  const dims: { label: string; value: number | null }[] = [
    { label: "Structure", value: check.structureScore },
    { label: "Academic Writing", value: check.academicScore },
    { label: "Citations", value: check.citationScore },
    { label: "References", value: check.referenceScore },
    { label: "Guideline Compliance", value: check.complianceScore },
    { label: "Clarity", value: check.clarityScore },
  ];

  const sorted = [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Academic Readiness</h2>
          <span
            className={`text-3xl font-bold ${scoreColor(check.overallScore ?? 0)}`}
          >
            {check.overallScore ?? 0}
            <span className="text-base font-normal text-slate-400">/100</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          An internal quality indicator computed from the issues found — not a
          plagiarism or AI-detection prediction.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {dims.map((d) => (
            <div key={d.label}>
              <dt className="text-xs text-slate-500">{d.label}</dt>
              <dd className={`font-semibold ${scoreColor(d.value ?? 0)}`}>
                {d.value ?? 0}%
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Issues found ({issues.length})
        </h2>
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            No issues detected.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((issue) => (
              <li
                key={issue.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {issue.category.replace(/_/g, " ")}
                  </span>
                  {issue.location && (
                    <span className="text-xs text-slate-400">
                      · {issue.location}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {issue.explanation}
                </p>
                {issue.suggestedRevision && (
                  <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    <span className="font-medium">Suggestion: </span>
                    {issue.suggestedRevision}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
