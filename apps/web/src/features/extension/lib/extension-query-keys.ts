export const extensionKeys = {
  all: (userId: string) => ["extension", userId] as const,
  cardmarketOverlay: (userId: string, sortedListIds: readonly string[]) =>
    ["extension", userId, "cardmarket-overlay", sortedListIds] as const,
  cardmarketPicks: (userId: string, rowsKey: string) =>
    ["extension", userId, "cardmarket-picks", rowsKey] as const,
} as const;
