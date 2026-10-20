/**
 * Which rows a double-sided printing's copies already cover: when cards are bought as the same
 * printing, the card needing the most copies pays and the others' rows come with it.
 */
export function coveredByPairPartner(
  rows: readonly { cardId: string; printingId: string | undefined; amount: number }[],
): boolean[] {
  const totalsByPrinting = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.printingId === undefined) {
      continue;
    }
    const byCard = totalsByPrinting.get(row.printingId) ?? new Map<string, number>();
    byCard.set(row.cardId, (byCard.get(row.cardId) ?? 0) + row.amount);
    totalsByPrinting.set(row.printingId, byCard);
  }
  const payerByPrinting = new Map<string, string>();
  for (const [printingId, byCard] of totalsByPrinting) {
    let payer: [string, number] | undefined;
    for (const entry of byCard) {
      if (payer === undefined || entry[1] > payer[1]) {
        payer = entry;
      }
    }
    if (payer !== undefined) {
      payerByPrinting.set(printingId, payer[0]);
    }
  }
  return rows.map(
    (row) => row.printingId !== undefined && payerByPrinting.get(row.printingId) !== row.cardId,
  );
}
