import { COMPARABLE_CARD_FIELDS } from "@openrift/shared/catalog-field-compare";
import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
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

const EXTRA_CARD_FIELDS: readonly RecordFieldDef[] = (
  ["maxCopiesOverride", "additionalLegendCount", "comment"] as const
).map((field) => ({ field, label: CARD_FIELD_LABELS[field], comparable: false }));

export const CARD_RECORD_FIELDS: readonly RecordFieldDef[] = [
  ...COMPARABLE_CARD_FIELDS.map((field) => ({
    field,
    label: CARD_FIELD_LABELS[field],
    comparable: true,
  })),
  ...EXTRA_CARD_FIELDS,
];

function activeImageUrl(
  printing: AdminPrintingResponse,
  images: readonly AdminPrintingImageResponse[],
): string | null {
  const active = imagesOnSide(images, printing).find((image) => image.isActive);
  return active === undefined ? null : printingImageDisplayUrl(active);
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
