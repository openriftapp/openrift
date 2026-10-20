import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

export interface FaceRow {
  faceId: string;
  language: string;
  printing: AdminPrintingResponse;
  printings: AdminPrintingResponse[];
}

export function buildFaceRows(printings: readonly AdminPrintingResponse[]): FaceRow[] {
  return [...Map.groupBy(printings, (printing) => printing.faceId)].map(([faceId, rows]) => {
    const [first] = rows as [AdminPrintingResponse, ...AdminPrintingResponse[]];
    return { faceId, language: first.language, printing: first, printings: rows };
  });
}

export function printingPairName(printing: AdminPrintingResponse, cardName: string): string {
  const other = printing.otherFace;
  if (other === null) {
    return cardName;
  }
  return printing.side === 2
    ? `${other.cardName} // ${cardName}`
    : `${cardName} // ${other.cardName}`;
}

export function pairNamesByPrinting(
  printings: readonly AdminPrintingResponse[],
  cardName: string,
): Map<string, string> {
  return new Map(
    printings
      .filter((printing) => printing.otherFace !== null)
      .map((printing) => [printing.id, printingPairName(printing, cardName)]),
  );
}

/** The faces of this card a printing shows: two for a printing with the card on both faces. */
export function faceIdsOfPrinting(
  printings: readonly AdminPrintingResponse[],
  printingId: string,
): string[] {
  return [...new Set(printings.filter((row) => row.id === printingId).map((row) => row.faceId))];
}
