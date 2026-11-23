import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  WorkspaceOwner,
  WorkspaceRecordRow,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { pluralize } from "@openrift/shared/strings";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

import { deskPrintingCodes, deskPrintingName } from "@/features/admin/lib/desk-face-options";

export type WorkspaceTarget =
  | { kind: "card"; cardSlug: string }
  | { kind: "card-new"; name: string }
  | { kind: "face"; cardSlug: string; faceId: string }
  | { kind: "printing"; printingId: string };

export type WorkspaceRole = "admin" | "reviewer" | "desk" | "none";

export type DeskMode = "mine" | "promos";

export type DeskRow = DeskPrintingRow;

export interface ListEntry {
  key: string;
  title: string;
  code?: string;
  target: WorkspaceTarget | null;
}

const OWNER_ORDER: readonly WorkspaceOwner[] = ["card", "face", "printing"];

export const OWNER_LABELS: Record<WorkspaceOwner, string> = {
  card: "Cards",
  face: "Faces",
  printing: "Printings",
};

export function workspaceRole(
  access: { isAdmin: boolean; sections: readonly string[] } | undefined,
): WorkspaceRole {
  if (access === undefined) {
    return "none";
  }
  if (access.isAdmin) {
    return "admin";
  }
  if (access.sections.includes("card-review")) {
    return "reviewer";
  }
  if (access.sections.includes("printing-desk")) {
    return "desk";
  }
  return "none";
}

export function ownersForRole(role: WorkspaceRole): readonly WorkspaceOwner[] {
  if (role === "admin" || role === "reviewer") {
    return OWNER_ORDER;
  }
  if (role === "desk") {
    return ["printing"];
  }
  return [];
}

function targetKey(target: WorkspaceTarget): string {
  switch (target.kind) {
    case "card": {
      return `card:${target.cardSlug}`;
    }
    case "card-new": {
      return `card-new:${target.name}`;
    }
    case "face": {
      return `face:${target.faceId}`;
    }
    case "printing": {
      return `printing:${target.printingId}`;
    }
  }
}

interface PendingBadge {
  label: string;
  variant: "warning" | "violet" | "neutral" | "info";
}

export function cardPendingBadges(row: CandidateCardSummaryResponse): PendingBadge[] {
  const badges: PendingBadge[] = [];
  if (row.cardSlug === null) {
    badges.push({
      label: `${row.candidateCount} ${pluralize(row.candidateCount, "source")}`,
      variant: "neutral",
    });
    if (row.uncheckedTrustedProviders.length > 0) {
      badges.push({ label: "Trusted", variant: "info" });
    }
  }
  const fromSources = row.uncheckedCardCount + row.uncheckedPrintingCount;
  if (row.cardSlug !== null && fromSources > 0) {
    badges.push({ label: `${fromSources} from sources`, variant: "warning" });
  }
  if (row.pendingSubmissions > 0) {
    badges.push({
      label: `${row.pendingSubmissions} ${pluralize(row.pendingSubmissions, "proposal")}`,
      variant: "violet",
    });
  }
  return badges;
}

export function cardSummaryKey(row: CandidateCardSummaryResponse): string {
  const target = cardSummaryTarget(row);
  return target ? targetKey(target) : `card-row:${row.name}`;
}

export function recordEntry(owner: "face" | "printing", row: WorkspaceRecordRow): ListEntry {
  return {
    key: owner === "face" ? `face:${row.id}` : `printing:${row.id}`,
    title: row.cardName,
    code: row.shortCode,
    target:
      owner === "face"
        ? { kind: "face", cardSlug: row.cardSlug, faceId: row.id }
        : { kind: "printing", printingId: row.id },
  };
}

export function cardSummaryTarget(row: CandidateCardSummaryResponse): WorkspaceTarget | null {
  if (row.cardSlug !== null) {
    return { kind: "card", cardSlug: row.cardSlug };
  }
  return row.normalizedName === "" ? null : { kind: "card-new", name: row.normalizedName };
}

export function deskEntry(row: DeskRow): ListEntry {
  return {
    key: `printing:${row.printingId}`,
    title: deskPrintingName(row),
    code: deskPrintingCodes(row),
    target: { kind: "printing", printingId: row.printingId },
  };
}

export function filterCardSummaries(
  rows: readonly CandidateCardSummaryResponse[],
  query: string | undefined,
): CandidateCardSummaryResponse[] {
  const trimmed = query?.trim() ?? "";
  return rows
    .filter(
      (row) =>
        trimmed === "" ||
        matchesCardQuery(trimmed, [row.name, ...row.shortCodes, ...row.stagingShortCodes]),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function filterDeskRows(rows: readonly DeskRow[], query: string | undefined): DeskRow[] {
  const trimmed = query?.trim() ?? "";
  if (trimmed === "") {
    return [...rows];
  }
  return rows.filter((row) =>
    matchesCardQuery(trimmed, [
      row.cardName,
      row.shortCode,
      row.secondSide?.cardName,
      row.secondSide?.shortCode,
    ]),
  );
}
