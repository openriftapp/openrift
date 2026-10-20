import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatPrintingCode } from "@openrift/shared/printing-code";

export interface DeskFaceOption {
  value: DeskImage["face"];
  label: string;
}

/** A double-faced printing names each image slot by the card on that face. */
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
    { value: "front", label: `${first}'s face` },
    { value: "back", label: `${other}'s face` },
  ];
}

/** Both cards of a double-faced printing, face 1 first. */
export function deskPrintingName(printing: DeskPrintingRow): string {
  const second = printing.secondSide;
  if (!second) {
    return printing.cardName;
  }
  return printing.side === 2
    ? `${second.cardName} // ${printing.cardName}`
    : `${printing.cardName} // ${second.cardName}`;
}

export function deskPrintingCodes(printing: DeskPrintingRow): string {
  const own = formatPrintingCode(printing.publicCode);
  const second = printing.secondSide;
  if (!second) {
    return own;
  }
  const other = formatPrintingCode(second.publicCode);
  return printing.side === 2 ? `${other} // ${own}` : `${own} // ${other}`;
}
