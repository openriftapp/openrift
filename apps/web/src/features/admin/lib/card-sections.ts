const CARD_SECTIONS = [
  "overview",
  "attention",
  "fields",
  "printings",
  "marketplace",
  "bans",
  "history",
] as const;

export type CardSection = (typeof CARD_SECTIONS)[number];

export const DEFAULT_CARD_SECTION: CardSection = "overview";

export const CARD_SECTION_LABELS: Record<CardSection, string> = {
  overview: "Overview",
  attention: "Attention",
  fields: "Card fields",
  printings: "Printings",
  marketplace: "Marketplace",
  bans: "Bans & errata",
  history: "History",
};

const ADMIN_ONLY_SECTIONS: CardSection[] = ["marketplace", "bans", "history"];

export function isCardSection(value: unknown): value is CardSection {
  return CARD_SECTIONS.some((section) => section === value);
}

export function cardSectionsFor(isAdmin: boolean): CardSection[] {
  return isAdmin
    ? [...CARD_SECTIONS]
    : CARD_SECTIONS.filter((section) => !ADMIN_ONLY_SECTIONS.includes(section));
}
