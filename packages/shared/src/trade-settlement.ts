export interface TradeSettlementOptions {
  quantity?: number;
  targetCollectionId?: string;
  copyIds?: string[];
}

export function tradeSettlementFingerprint(
  action: "apply" | "skip",
  options: TradeSettlementOptions,
): string {
  return JSON.stringify([
    action,
    options.quantity ?? null,
    options.targetCollectionId ?? null,
    options.copyIds?.toSorted() ?? null,
  ]);
}
