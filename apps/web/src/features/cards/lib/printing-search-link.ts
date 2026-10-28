import type { Printing } from "@openrift/shared/types/catalog";

type LinkedPrinting = Pick<Printing, "shortCode" | "finish" | "language" | "otherSide">;

/** A token side carries only its set code ("OGN"), so its paired side's code names the printing. */
export function distinctPrintingCode(printing: {
  shortCode: string;
  otherSide?: { shortCode: string };
}): string {
  return printing.otherSide && !/\d/u.test(printing.shortCode)
    ? printing.otherSide.shortCode
    : printing.shortCode;
}

export function printingCollectionSearch(printing: LinkedPrinting) {
  return {
    search: `id:${distinctPrintingCode(printing)}`,
    view: "printings" as const,
    finishes: [printing.finish],
    languages: [printing.language],
  };
}
