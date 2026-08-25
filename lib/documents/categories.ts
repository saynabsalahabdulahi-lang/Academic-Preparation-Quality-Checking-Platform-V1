import { DocumentCategory } from "@prisma/client";

// Human-friendly labels for the document-type selector. The enum drives which
// checks run in later phases; this map is presentation only.
export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ASSIGNMENT: "Assignment",
  RESEARCH_PROPOSAL: "Research Proposal",
  LITERATURE_REVIEW: "Literature Review",
  ARTICLE_REVIEW: "Article Review",
  RESEARCH_ARTICLE: "Research Article",
  THESIS_CHAPTER: "Thesis Chapter",
  DISSERTATION_CHAPTER: "Dissertation Chapter",
  SEMINAR_PAPER: "Seminar Paper",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as DocumentCategory, label }),
);
