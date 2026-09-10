import type { AcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

import type { PrintingFormDefaults } from "@/features/cards/lib/printing-form-defaults";
import { printingFormDefaults } from "@/features/cards/lib/printing-form-defaults";
import { sameFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";

export interface PrintingDraft extends PrintingFormDefaults {
  comment: string;
}

export interface PrintingFieldChange {
  field: AcceptPrintingField;
  value: unknown;
}

export function printingDraft(printing: AdminPrintingResponse): PrintingDraft {
  return {
    ...printingFormDefaults(printing, {
      setSlug: printing.setSlug,
      rarity: printing.rarity,
      artVariant: printing.artVariant,
      finish: printing.finish,
      size: printing.size,
      language: printing.language,
    }),
    comment: printing.comment ?? "",
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function draftYear(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of a form field; Number() would yield NaN on trailing text
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftValues(draft: PrintingDraft): Record<AcceptPrintingField, unknown> {
  return {
    shortCode: draft.shortCode.trim(),
    setId: draft.setId,
    rarity: draft.rarity,
    artVariant: draft.artVariant,
    isSigned: draft.isSigned,
    isOvernumbered: draft.isOvernumbered,
    markerSlugs: draft.markerSlugs,
    distributionChannelSlugs: draft.distributionChannelSlugs,
    finish: draft.finish,
    size: draft.size,
    artist: draft.artist.trim(),
    publicCode: draft.publicCode.trim(),
    printedRulesText: blankToNull(draft.printedRulesText),
    printedEffectText: blankToNull(draft.printedEffectText),
    flavorText: blankToNull(draft.flavorText),
    language: draft.language,
    printedName: blankToNull(draft.printedName),
    printedYear: draftYear(draft.printedYear),
    comment: blankToNull(draft.comment),
  };
}

export function printingDraftChanges(
  printing: AdminPrintingResponse,
  draft: PrintingDraft,
): PrintingFieldChange[] {
  const current = draftValues(printingDraft(printing));
  const next = draftValues(draft);
  const changes: PrintingFieldChange[] = [];
  for (const [key, value] of Object.entries(next)) {
    const field = key as AcceptPrintingField;
    if (!sameFieldValue(current[field], value, field)) {
      changes.push({ field, value });
    }
  }
  return changes;
}

export function printingDraftIsValid(draft: PrintingDraft): boolean {
  return (
    draft.shortCode.trim().length > 0 &&
    draft.setId.length > 0 &&
    draft.artist.trim().length > 0 &&
    draft.publicCode.trim().length > 0
  );
}
