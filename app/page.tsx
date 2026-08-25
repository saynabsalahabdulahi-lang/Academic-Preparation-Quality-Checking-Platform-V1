import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
          Academic Prepare
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Prepare your academic writing with confidence
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Upload your document and get clear, actionable feedback on grammar,
          clarity, structure, citations, and your program&apos;s guidelines —
          then revise it in your own words before you submit.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Sign in
        </Link>
      </div>

      <p className="max-w-xl text-sm text-slate-500">
        Academic Prepare helps you improve your own writing. It is not a tool to
        bypass plagiarism or AI detection or any university academic-integrity
        policy.
      </p>
    </main>
  );
}
