import { requireUser } from "@/lib/auth/session";
import { CATEGORY_OPTIONS } from "@/lib/documents/categories";
import { UploadForm } from "./upload-form";

export default async function NewDocumentPage() {
  await requireUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Upload a document</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Upload a Word (.docx) document to prepare it for submission.
      </p>
      <UploadForm categories={CATEGORY_OPTIONS} />
    </main>
  );
}
