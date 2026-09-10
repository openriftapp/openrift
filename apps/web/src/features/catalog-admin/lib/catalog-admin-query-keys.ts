export const catalogAdminKeys = {
  reviewQueue: ["admin", "catalog", "review-queue"] as const,
  publicPreview: (cardSlug: string) => ["admin", "catalog", "public-preview", cardSlug] as const,
} as const;
