import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { createContext } from "react";

type OtherSideLookup = (printing: Printing) => Printing | undefined;

/** Null outside a provider: tiles then show the other side without letting it be flipped to. */
export const OtherSideContext = createContext<OtherSideLookup | null>(null);

export function otherSideLookup(bySideKey: Readonly<Record<string, Printing>>): OtherSideLookup {
  return (printing) =>
    printing.otherSide
      ? bySideKey[sideKey({ printingId: printing.printingId, side: printing.side === 1 ? 2 : 1 })]
      : undefined;
}
