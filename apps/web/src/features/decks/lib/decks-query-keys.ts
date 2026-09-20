export const decksKeys = {
  all: (userId: string) => ["decks", userId] as const,
  syncedStore: (userId: string) => ["decks", userId, "store"] as const,
  cardsStore: (userId: string) => ["decks", userId, "cards-store"] as const,
  detail: (userId: string, id: string) => ["decks", userId, id] as const,
  plan: (userId: string, id: string) => ["decks", userId, id, "plan"] as const,
  publicByToken: (token: string) => ["decks", "share", token] as const,
} as const;

export const deckFoldersKeys = {
  all: (userId: string) => ["deck-folders", userId] as const,
  syncedStore: (userId: string) => ["deck-folders", userId, "store"] as const,
} as const;
