import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";

export interface DeskFaceOption {
  value: DeskImage["face"];
  label: string;
}

/** A double-sided printing names each image side by the card on it. */
export function deskFaceOptions(printing: DeskPrintingRow): DeskFaceOption[] {
  const second = printing.secondSide;
  if (!second) {
    return [{ value: "front", label: "Images" }];
  }
  const [first, other] =
    printing.side === 2
      ? [second.cardName, printing.cardName]
      : [printing.cardName, second.cardName];
  return [
    { value: "front", label: `${first}'s side` },
    { value: "back", label: `${other}'s side` },
  ];
}

/** Both cards of a double-sided printing, side 1 first. */
export function deskPrintingName(printing: DeskPrintingRow): string {
  const second = printing.secondSide;
  if (!second) {
    return printing.cardName;
  }
  return printing.side === 2
    ? `${second.cardName} // ${printing.cardName}`
    : `${printing.cardName} // ${second.cardName}`;
}
