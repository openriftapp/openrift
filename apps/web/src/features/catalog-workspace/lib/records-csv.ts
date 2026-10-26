import type { WorkspaceRecordRow } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

import { escapeCsvField } from "@/features/collections/lib/csv-export";

const LIST_SEPARATOR = "; ";

type CsvValue = string | number | boolean | null | undefined;

function csvLine(values: readonly CsvValue[]): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "boolean") {
        return value ? "yes" : "no";
      }
      return escapeCsvField(String(value));
    })
    .join(",");
}

function buildCsv<T>(headers: readonly string[], rows: readonly T[], line: (row: T) => CsvValue[]) {
  return [csvLine(headers), ...rows.map((row) => csvLine(line(row)))].join("\n");
}

const CARD_HEADERS = [
  "Card",
  "Card slug",
  "Draft",
  "First set",
  "Printings",
  "Open from sources",
  "Proposals",
  "Updated",
] as const;

export function buildCardsCsv(rows: readonly CandidateCardSummaryResponse[]): string {
  return buildCsv(CARD_HEADERS, rows, (row) => [
    row.name,
    row.cardSlug ?? "",
    row.cardSlug === null,
    row.setSlugs.at(0) ?? "",
    row.cardSlug === null ? row.stagingShortCodes.length : row.shortCodes.length,
    row.uncheckedCardCount + row.uncheckedPrintingCount,
    row.pendingSubmissions,
    row.updatedAt,
  ]);
}

const PRINTING_HEADERS = [
  "Card",
  "Card slug",
  "Code",
  "Public code",
  "Set",
  "Language",
  "Finish",
  "Markers",
  "Channel",
  "Status",
  "Double-sided",
  "Images",
  "Promo",
  "Updated",
] as const;

export function buildPrintingsCsv(rows: readonly WorkspaceRecordRow[]): string {
  return buildCsv(PRINTING_HEADERS, rows, (row) => [
    row.cardName,
    row.cardSlug,
    row.shortCode,
    row.publicCode,
    row.setName,
    row.language,
    row.finish,
    row.markers?.join(LIST_SEPARATOR),
    row.channelLabel,
    row.status,
    row.isDoubleSided,
    row.imageCount,
    row.isPromo,
    row.updatedAt,
  ]);
}

const FACE_HEADERS = [
  "Card",
  "Card slug",
  "Code",
  "Set",
  "Language",
  "Finish",
  "Rarity",
  "Art variant",
  "Artist",
  "Image",
  "Used on printings",
  "Updated",
] as const;

export function buildFacesCsv(rows: readonly WorkspaceRecordRow[]): string {
  return buildCsv(FACE_HEADERS, rows, (row) => [
    row.cardName,
    row.cardSlug,
    row.shortCode,
    row.setName,
    row.language,
    row.finish,
    row.rarity,
    row.artVariant,
    row.artist,
    row.imageState,
    row.printingCount,
    row.updatedAt,
  ]);
}

export function recordsCsvFilename(kind: "cards" | "printings" | "faces", today: string): string {
  return `catalog-${kind}-${today}.csv`;
}
