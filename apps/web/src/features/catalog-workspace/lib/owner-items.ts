import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  WorkspaceOwner,
  WorkspaceRecordRow,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
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
  setSlug?: string,
): CandidateCardSummaryResponse[] {
  const trimmed = query?.trim() ?? "";
  const set = setSlug?.toLowerCase();
  return rows
    .filter((row) => set === undefined || row.setSlugs.some((slug) => slug.toLowerCase() === set))
    .filter(
      (row) =>
        trimmed === "" ||
        matchesCardQuery(trimmed, [row.name, ...row.shortCodes, ...row.stagingShortCodes]),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

const codeCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const CODE_LABEL = /^(?<code>.*?)(?: \[(?<language>[^\]]+)\])?$/u;

/** Each card sits at its earliest printing by language, set and code; others go last. */
export function sortCardsByCatalogOrder(
  rows: readonly CandidateCardSummaryResponse[],
  order: { languages: readonly string[]; sets: readonly string[] },
): CandidateCardSummaryResponse[] {
  const languageIndex = new Map(order.languages.map((code, index) => [code, index]));
  const setIndex = new Map(order.sets.map((slug, index) => [slug.toLowerCase(), index]));
  const place = (row: CandidateCardSummaryResponse) => {
    let best: { language: number; set: number; code: string } | null = null;
    for (const label of row.shortCodes) {
      const groups = CODE_LABEL.exec(label)?.groups;
      const code = groups?.code ?? label;
      const set = setIndex.get(code.split("-")[0]?.toLowerCase() ?? "");
      if (set === undefined) {
        continue;
      }
      const language = languageIndex.get(groups?.language ?? "EN") ?? order.languages.length;
      const here = { language, set, code };
      if (best === null || comparePlace(here, best) < 0) {
        best = here;
      }
    }
    return best ?? { language: Number.POSITIVE_INFINITY, set: 0, code: "" };
  };
  return rows
    .map((row) => ({ row, at: place(row) }))
    .toSorted((a, b) => comparePlace(a.at, b.at) || a.row.name.localeCompare(b.row.name))
    .map((entry) => entry.row);
}

interface CatalogPlace {
  language: number;
  set: number;
  code: string;
}

function comparePlace(a: CatalogPlace, b: CatalogPlace): number {
  if (a.language !== b.language) {
    return a.language < b.language ? -1 : 1;
  }
  return a.set - b.set || codeCollator.compare(a.code, b.code);
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
