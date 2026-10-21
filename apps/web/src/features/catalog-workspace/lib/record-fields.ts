import type { CardStatLabels } from "@openrift/shared/card-stat-line";
import type { ComparableCardField } from "@openrift/shared/catalog-field-compare";
import { COMPARABLE_CARD_FIELDS, hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { enumLabel } from "@openrift/shared/enum-label";
import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";

export interface RecordFieldDef {
  field: AcceptCardField;
  label: string;
  comparable: boolean;
}

const EXTRA_CARD_FIELDS: readonly RecordFieldDef[] = [
  { field: "maxCopiesOverride", label: "Max copies override", comparable: false },
  { field: "additionalLegendCount", label: "Additional legends", comparable: false },
  { field: "comment", label: "Comment", comparable: false },
];

export const CARD_RECORD_FIELDS: readonly RecordFieldDef[] = [
  ...COMPARABLE_CARD_FIELDS.map((field) => ({
    field,
    label: CARD_FIELD_LABELS[field],
    comparable: true,
  })),
  ...EXTRA_CARD_FIELDS,
];

const LABEL_GROUPS: Partial<Record<ComparableCardField, keyof CardStatLabels>> = {
  types: "cardTypes",
  superTypes: "superTypes",
  domains: "domains",
};

export function formatRecordValue(field: string, value: unknown, labels?: CardStatLabels): string {
  if (!hasFieldValue(value)) {
    return "—";
  }
  const group = LABEL_GROUPS[field as ComparableCardField];
  const map = group === undefined || labels === undefined ? undefined : labels[group];
  if (Array.isArray(value)) {
    return value.map((entry) => (map ? enumLabel(map, String(entry)) : String(entry))).join(" · ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return map ? enumLabel(map, String(value)) : String(value);
}

export function cardTypeLine(
  card: { superTypes: readonly string[]; types: readonly string[]; domains: readonly string[] },
  labels: CardStatLabels,
): string {
  const types = [
    ...card.types.map((slug) => enumLabel(labels.cardTypes, slug)),
    ...card.superTypes.map((slug) => enumLabel(labels.superTypes, slug)),
  ];
  const domains = card.domains.map((slug) => enumLabel(labels.domains, slug)).join(", ");
  return [...types, ...(domains === "" ? [] : [domains])].join(" · ");
}

export interface FaceTreePrinting {
  id: string;
  code: string;
  printing: AdminPrintingResponse;
}

export interface FaceTreeEntry {
  faceId: string;
  shortCode: string;
  language: string;
  imageUrl: string | null;
  openItems: number;
  printings: FaceTreePrinting[];
}

export interface FaceTreeFilter {
  language?: string;
  marker?: string;
}

function printingCode(printing: AdminPrintingResponse): string {
  const other = printing.otherFace;
  if (other === null) {
    return printing.shortCode;
  }
  return printing.side === 2
    ? `${other.publicCode} // ${printing.shortCode}`
    : `${printing.shortCode} // ${other.publicCode}`;
}

function activeImageUrl(
  printing: AdminPrintingResponse,
  images: readonly AdminPrintingImageResponse[],
): string | null {
  const active = imagesOnSide(images, printing).find((image) => image.isActive);
  return active === undefined ? null : printingImageDisplayUrl(active);
}

export function buildFaceTree(
  printings: readonly AdminPrintingResponse[],
  images: readonly AdminPrintingImageResponse[],
  openItems: ReadonlyMap<string, number>,
  filter: FaceTreeFilter = {},
): FaceTreeEntry[] {
  const kept = printings
    .filter((printing) => filter.language === undefined || printing.language === filter.language)
    .filter(
      (printing) => filter.marker === undefined || printing.markerSlugs.includes(filter.marker),
    )
    .toSorted((a, b) => a.canonicalRank - b.canonicalRank);
  return [...Map.groupBy(kept, (printing) => printing.faceId)].map(([faceId, rows]) => {
    const [first] = rows as [AdminPrintingResponse, ...AdminPrintingResponse[]];
    return {
      faceId,
      shortCode: first.shortCode,
      language: first.language,
      imageUrl: rows.map((row) => activeImageUrl(row, images)).find((url) => url !== null) ?? null,
      openItems: openItems.get(faceId) ?? 0,
      printings: rows.map((printing) => ({
        id: printing.id,
        code: printingCode(printing),
        printing,
      })),
    };
  });
}

export function primaryCardImage(
  printings: readonly AdminPrintingResponse[],
  images: readonly AdminPrintingImageResponse[],
): string | null {
  return (
    printings
      .toSorted((a, b) => a.canonicalRank - b.canonicalRank)
      .map((printing) => activeImageUrl(printing, images))
      .find((url) => url !== null) ?? null
  );
}

export function faceOpenCounts(
  items: readonly WorkspaceQueueItem[],
  cardSlug: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.owner === "face" && item.cardSlug === cardSlug) {
      counts.set(item.ownerId, (counts.get(item.ownerId) ?? 0) + 1);
    }
  }
  return counts;
}

export function cardWaitingSince(
  items: readonly WorkspaceQueueItem[],
  ownerId: string,
): string | null {
  const dates = items
    .filter((item) => item.owner === "card" && item.ownerId === ownerId)
    .map((item) => item.createdAt)
    .toSorted();
  return dates[0] ?? null;
}
