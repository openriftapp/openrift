export const CATALOG_TAB_VALUES = [
  "overview",
  "attention",
  "compare",
  "fields",
  "printings",
  "marketplace",
  "bans",
  "history",
] as const;

export type CatalogTab = (typeof CATALOG_TAB_VALUES)[number];

export const DEFAULT_CATALOG_TAB: CatalogTab = "overview";

export const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  overview: "Overview",
  attention: "Attention",
  compare: "Compare",
  fields: "Card fields",
  printings: "Printings",
  marketplace: "Marketplace",
  bans: "Bans & errata",
  history: "History",
};
