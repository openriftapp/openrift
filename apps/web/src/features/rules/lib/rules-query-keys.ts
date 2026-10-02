export const rulesKeys = {
  all: (kind: string) => ["rules", kind] as const,
  versions: (kind: string, language: string) => ["rules", kind, language, "versions"] as const,
  byVersion: (kind: string, language: string, version: string) =>
    ["rules", kind, language, version] as const,
  source: (kind: string, language: string, version: string) =>
    ["rules", kind, language, version, "source"] as const,
} as const;

export const boardStatesKeys = {
  all: (userId: string) => ["board-states", userId] as const,
  detail: (userId: string, id: string) => ["board-states", userId, id] as const,
  publicByToken: (token: string) => ["board-states", "share", token] as const,
  featured: () => ["board-states", "featured"] as const,
} as const;
