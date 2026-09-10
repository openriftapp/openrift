export const catalogAdminKeys = {
  all: ["admin", "catalog"] as const,
  reviewQueue: ["admin", "catalog", "review-queue"] as const,
  cards: ["admin", "catalog", "cards"] as const,
  sources: ["admin", "catalog", "sources"] as const,
  publicPreview: (cardSlug: string) => ["admin", "catalog", "public-preview", cardSlug] as const,
} as const;
