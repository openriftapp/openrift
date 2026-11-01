import type { Printing } from "@openrift/shared/types/catalog";

import { groupPrintingDesigns, isSelectedSide } from "@/features/cards/lib/printing-designs";

export interface PrintingImageGroup {
  key: string;
  printing: Printing;
  printings: Printing[];
  finishes: string[];
}

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

function imageKey(printing: Printing): string {
  const other = printing.otherSide;
  const back = other ? `back:${other.imageId ?? `face:${other.faceId}`}` : "";
  const front = printing.images[0]?.imageId;
  if (front !== undefined) {
    return `${front}|${back}`;
  }
  return [
    "none",
    printing.setId,
    printing.shortCode,
    printing.artVariant,
    printing.size,
    printing.isSigned,
    printing.isOvernumbered,
    printing.markers.map((marker) => marker.id).toSorted(),
    back,
  ].join("|");
}

/**
 * One group per distinct image among the Printings section's designs. `printings` must be in
 * language-preference order; `count` is the number of designs that section lists.
 */
export function groupPrintingImages(
  printings: readonly Printing[],
  selectedSideKey?: string,
): { count: number; groups: PrintingImageGroup[] } {
  const { designs } = groupPrintingDesigns(printings);
  const groups = new Map<string, PrintingImageGroup>();
  for (const design of designs) {
    const shown = shownMember([...design.byLanguage.values()], selectedSideKey);
    if (!shown) {
      continue;
    }
    const key = imageKey(shown);
    const group = groups.get(key);
    if (group) {
      group.printings.push(shown);
      if (!group.finishes.includes(shown.finish)) {
        group.finishes.push(shown.finish);
      }
      if (selectedSideKey !== undefined && isSelectedSide(shown, selectedSideKey)) {
        group.printing = shown;
      }
    } else {
      groups.set(key, { key, printing: shown, printings: [shown], finishes: [shown.finish] });
    }
  }
  return { count: designs.length, groups: [...groups.values()] };
}
