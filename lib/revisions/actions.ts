import { RevisionAction } from "@prisma/client";

export const ACTION_LABELS: Record<RevisionAction, string> = {
  CORRECT_GRAMMAR: "Correct Grammar",
  IMPROVE_CLARITY: "Improve Clarity",
  IMPROVE_TONE: "Improve Academic Tone",
  IMPROVE_FLOW: "Improve Paragraph Flow",
  REDUCE_REPETITION: "Reduce Repetition",
  IMPROVE_SENTENCE_STRUCTURE: "Improve Sentence Structure",
  REWRITE_IN_STYLE: "Rewrite in My Writing Style",
};

export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ value: value as RevisionAction, label }),
);
