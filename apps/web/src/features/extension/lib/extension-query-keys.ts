import type { Marketplace } from "@openrift/shared/types/pricing";

export const extensionKeys = {
  cardmarketOverlay: (userId: string, marketplace: Marketplace, sortedListIds: readonly string[]) =>
    ["extension", userId, "cardmarket-overlay", marketplace, sortedListIds] as const,
  cardmarketPicks: (userId: string, rowsKey: string) =>
    ["extension", userId, "cardmarket-picks", rowsKey] as const,
} as const;
