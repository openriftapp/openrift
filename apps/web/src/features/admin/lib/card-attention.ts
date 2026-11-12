import { countNoun } from "@openrift/shared/strings";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

import type { AdminCardListStatus, CardIssue } from "@/features/admin/lib/admin-search-values";
import { CARD_ISSUES } from "@/features/admin/lib/admin-search-values";

export { CARD_ISSUES } from "@/features/admin/lib/admin-search-values";
export type { AdminCardListStatus, CardIssue } from "@/features/admin/lib/admin-search-values";

export const CARD_ISSUE_LABELS: Record<CardIssue, string> = {
  proposals: "Pending submissions",
  "new-printings": "New trusted printings",
  "unlinked-products": "Unlinked marketplace entries",
  "unchecked-source": "Unchecked trusted source",
};

export const ANY_ISSUE = "any";

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
  tone: "warning" | "violet" | "info" | "neutral";
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

/** Marketplace work has its own section; every other issue is decided in Fields & faces. */
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
      label: countNoun(row.pendingSubmissions, "submission"),
      tone: "warning",
    });
  }
  if (row.unlinkedTrustedPrintingCount > 0) {
    const fromOthers = row.unlinkedPrintingCount - row.unlinkedTrustedPrintingCount;
    badges.push({
      key: "new-printings",
      label: countNoun(row.unlinkedTrustedPrintingCount, "new trusted printing"),
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
      label: countNoun(row.candidateCount, "source"),
      tone: "neutral",
    });
  }
  if (unlinked > 0) {
    badges.push({
      key: "unlinked-products",
      label: `marketplace: ${unlinked} unlinked`,
      tone: "neutral",
    });
  }
  return badges;
}
