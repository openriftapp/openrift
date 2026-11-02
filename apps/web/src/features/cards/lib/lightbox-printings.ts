import type { Printing } from "@openrift/shared/types/catalog";

import { groupPrintingDesigns, isSelectedSide } from "@/features/cards/lib/printing-designs";

function shownMember(members: readonly Printing[], selectedSideKey?: string): Printing | undefined {
  const selected =
    selectedSideKey === undefined
      ? undefined
      : members.find((member) => isSelectedSide(member, selectedSideKey));
  const [lead] = members;
  if (selected) {
    return selected;
  }
  if (lead && lead.images.length > 0) {
    return lead;
  }
  return members.find((member) => member.images.length > 0) ?? lead;
}

/** `printings` must be in language-preference order. */
export function lightboxPrintings(
  printings: readonly Printing[],
  selectedSideKey?: string,
): Printing[] {
  return groupPrintingDesigns(printings).designs.flatMap((design) => {
    const shown = shownMember([...design.byLanguage.values()], selectedSideKey);
    return shown ? [shown] : [];
  });
}

/** `printings` must be in language-preference order. */
export function lightboxPrintingsInLanguage(
  printings: readonly Printing[],
  language: string,
): Printing[] {
  return groupPrintingDesigns(printings).designs.flatMap((design) => {
    const member = design.byLanguage.get(language);
    return member ? [member] : [];
  });
}
