import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import type { ImportEntry } from "@/features/collections/lib/import-parsers";
import { m } from "@/paraglide/messages.js";

export function importSpecialties(
  entry: Pick<ImportEntry, "finish" | "artVariant" | "isOvernumbered">,
  finishLabels: LabelMap,
  artVariantLabels: LabelMap,
): string | null {
  const parts: string[] = [];
  if (entry.finish !== WellKnown.finish.NORMAL) {
    parts.push(enumLabel(finishLabels, entry.finish));
  }
  if (entry.artVariant === WellKnown.artVariant.ALTART) {
    parts.push(enumLabel(artVariantLabels, WellKnown.artVariant.ALTART));
  }
  if (entry.isOvernumbered) {
    parts.push(m.cards_flag_overnumbered());
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
