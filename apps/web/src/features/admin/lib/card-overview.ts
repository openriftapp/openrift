import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { groupDesigns } from "@/features/cards/lib/printing-designs";

export function firstPrintingSetLabel(printings: readonly AdminPrintingResponse[]): string | null {
  const first = printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank).at(0);
  if (first === undefined) {
    return null;
  }
  return first.setName ?? first.setSlug;
}

function adminFaceDesignKey(printing: AdminPrintingResponse): string {
  return [
    printing.setId,
    printing.shortCode,
    printing.finish,
    printing.artVariant,
    printing.isSigned,
    printing.isOvernumbered,
    printing.markerSlugs.toSorted(),
  ].join("|");
}

function adminDesignKey(printing: AdminPrintingResponse): string {
  return [
    adminFaceDesignKey(printing),
    printing.side,
    printing.size,
    printing.otherFace?.cardSlug ?? "",
  ].join("|");
}

/** `printings` must be in language-preference order. */
export function groupAdminPrintingDesigns(printings: readonly AdminPrintingResponse[]): {
  languages: string[];
  designs: PrintingDesign<AdminPrintingResponse>[];
} {
  return groupDesigns(printings, adminDesignKey);
}
