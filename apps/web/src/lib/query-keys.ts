export const featureFlagsKeys = {
  all: ["feature-flags"] as const,
} as const;

export const siteSettingsKeys = {
  all: ["site-settings"] as const,
} as const;

export const initKeys = {
  all: ["init"] as const,
} as const;

/** Keys of the shared SSR `serverCache` QueryClient; never used on the per-request client. */
export const serverCacheKeys = {
  all: ["server-cache"] as const,
  init: ["server-cache", "init"] as const,
  prices: ["server-cache", "prices"] as const,
  catalog: ["server-cache", "catalog"] as const,
  featureFlags: ["server-cache", "feature-flags"] as const,
  siteSettings: ["server-cache", "site-settings"] as const,
  landingSummary: ["server-cache", "landing-summary"] as const,
  errata: ["server-cache", "errata"] as const,
  sets: ["server-cache", "sets"] as const,
  setDetail: (setSlug: string) => ["server-cache", "set-detail", setSlug] as const,
  cardDetail: (cardSlug: string) => ["server-cache", "card-detail", cardSlug] as const,
  products: ["server-cache", "products"] as const,
  promos: (language: string) => ["server-cache", "promos", language] as const,
  rules: {
    all: ["server-cache", "rules"] as const,
    page: (kind: string, language: string, version: string) =>
      ["server-cache", "rules", kind, language, version, "page"] as const,
    source: (kind: string, language: string, version: string) =>
      ["server-cache", "rules", kind, language, version, "source"] as const,
    numbers: (kind: string, version: string) =>
      ["server-cache", "rules", kind, version, "numbers"] as const,
  },
  rulesVersions: {
    all: ["server-cache", "rules-versions"] as const,
    list: (language: string, kind: string) =>
      ["server-cache", "rules-versions", language, kind] as const,
  },
  meta: (resource: string, ...parts: readonly unknown[]) =>
    ["server-cache", "meta", resource, ...parts] as const,
} as const;
