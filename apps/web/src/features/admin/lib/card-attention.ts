import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

export const CARD_ISSUES = [
  "proposals",
  "new-printings",
  "unlinked-products",
  "unchecked-source",
] as const;

export type CardIssue = (typeof CARD_ISSUES)[number];

export const CARD_ISSUE_LABELS: Record<CardIssue, string> = {
  proposals: "Pending submissions",
  "new-printings": "New trusted printings",
  "unlinked-products": "Unlinked marketplace entries",
  "unchecked-source": "Unchecked trusted source",
};

export const ANY_ISSUE = "any";

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

export function listStatusFor(
  attentionTab: boolean,
  issue?: CardIssue,
): AdminCardListStatus | undefined {
  if (issue === "unlinked-products") {
    return "prices-to-assign";
  }
  if (issue) {
    return issue;
  }
  return attentionTab ? "attention" : undefined;
}

export interface AttentionBadge {
  key: CardIssue | "sources";
  label: string;
  title?: string;
  tone: "warning" | "violet" | "info" | "muted";
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function hasIssue(
  row: CandidateCardSummaryResponse,
  issue: CardIssue,
  unlinked: number,
): boolean {
  if (issue === "proposals") {
    return row.pendingSubmissions > 0;
  }
  if (issue === "new-printings") {
    return row.unlinkedTrustedPrintingCount > 0;
  }
  if (issue === "unlinked-products") {
    return unlinked > 0;
  }
  return row.uncheckedTrustedProviders.length > 0;
}

export function needsAttention(row: CandidateCardSummaryResponse, unlinked: number): boolean {
  return CARD_ISSUES.some((issue) => hasIssue(row, issue, unlinked));
}

/** Marketplace work has its own section; every other issue is decided in Attention. */
export function attentionSectionFor(
  row: CandidateCardSummaryResponse,
  unlinked: number,
  issue?: CardIssue,
): "attention" | "marketplace" | undefined {
  const open = issue ? [issue] : CARD_ISSUES.filter((option) => hasIssue(row, option, unlinked));
  if (open.length === 0) {
    return undefined;
  }
  return open.every((option) => option === "unlinked-products") ? "marketplace" : "attention";
}

export function cardAttentionBadges(
  row: CandidateCardSummaryResponse,
  unlinked = 0,
): AttentionBadge[] {
  const badges: AttentionBadge[] = [];
  if (row.pendingSubmissions > 0) {
    badges.push({
      key: "proposals",
      label: plural(row.pendingSubmissions, "submission"),
      tone: "warning",
    });
  }
  if (row.unlinkedTrustedPrintingCount > 0) {
    const fromOthers = row.unlinkedPrintingCount - row.unlinkedTrustedPrintingCount;
    badges.push({
      key: "new-printings",
      label: plural(row.unlinkedTrustedPrintingCount, "new trusted printing"),
      title: fromOthers > 0 ? `${fromOthers} more proposed by sources you do not trust` : undefined,
      tone: "violet",
    });
  }
  if (row.uncheckedTrustedProviders.length > 0) {
    badges.push({
      key: "unchecked-source",
      label: `unchecked: ${row.uncheckedTrustedProviders.join(", ")}`,
      tone: "info",
    });
  }
  if (row.cardSlug === null && row.candidateCount > 0) {
    badges.push({
      key: "sources",
      label: plural(row.candidateCount, "source"),
      tone: "muted",
    });
  }
  if (unlinked > 0) {
    badges.push({
      key: "unlinked-products",
      label: `marketplace: ${unlinked} unlinked`,
      tone: "muted",
    });
  }
  return badges;
}
