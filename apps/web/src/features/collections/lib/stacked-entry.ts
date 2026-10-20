import { legendDisplayName } from "@openrift/shared/card-name";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export interface StackedEntry {
  printingId: string;
  printing: Printing;
  sides?: Printing[];
  copyIds: string[];
}

export function stackSides(stack: StackedEntry): readonly Printing[] {
  return stack.sides ?? [stack.printing];
}

/** A stacked tile's id is its side key; any other id falls back to side 1. */
export function stackSideForTile(stack: StackedEntry, itemId: string): Printing {
  return stackSides(stack).find((side) => sideKey(side) === itemId) ?? stack.printing;
}

export function stackCardName(stack: StackedEntry): string {
  return stackSides(stack)
    .map((side) => legendDisplayName(side.card))
    .join(" // ");
}
