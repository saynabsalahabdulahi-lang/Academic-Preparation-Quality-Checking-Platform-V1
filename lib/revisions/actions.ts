import { RevisionAction } from "@prisma/client";

// IMPROVE_ALL is listed first: it applies every improvement in a single pass,
// which costs one credit instead of one per action.
export const ACTION_LABELS: Record<RevisionAction, string> = {
  IMPROVE_ALL: "Improve Everything (recommended)",
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
