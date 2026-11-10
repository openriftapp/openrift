// Read by admin `validateSearch`, which ships in the boot chunk. Keep this module free of imports.

export const CARD_ISSUES = [
  "proposals",
  "new-printings",
  "unlinked-products",
  "unchecked-source",
] as const;

export type CardIssue = (typeof CARD_ISSUES)[number];

/**
 * List-page filters that also narrow the card page's prev/next. "attention" is
 * the Needs attention tab without an issue filter. "review" comes from the
 * review inbox and returns there.
 */
export const ADMIN_CARD_LIST_STATUSES = [
  "attention",
  "proposals",
  "new-printings",
  "unchecked-source",
  "prices-to-assign",
  "review",
] as const;

export type AdminCardListStatus = (typeof ADMIN_CARD_LIST_STATUSES)[number];

export type ReviewFilter = "all" | "contributors" | "sources";

export const REVIEW_FILTERS: readonly ReviewFilter[] = ["all", "contributors", "sources"];

const CARD_SECTIONS = [
  "overview",
  "attention",
  "printings",
  "marketplace",
  "bans",
  "history",
] as const;

export type CardSection = (typeof CARD_SECTIONS)[number];

export function isCardSection(value: unknown): value is CardSection {
  return CARD_SECTIONS.some((section) => section === value);
}

export const POST_DATE_NONE = "none";
