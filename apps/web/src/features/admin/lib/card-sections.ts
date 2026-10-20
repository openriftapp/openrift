const CARD_SECTIONS = [
  "overview",
  "attention",
  "printings",
  "marketplace",
  "bans",
  "history",
] as const;

export type CardSection = (typeof CARD_SECTIONS)[number];

/** "attention" is a link target inside Fields & faces, not a section of its own. */
export type NavCardSection = Exclude<CardSection, "attention">;

export const DEFAULT_CARD_SECTION: NavCardSection = "overview";

export const CARD_SECTION_LABELS: Record<NavCardSection, string> = {
  overview: "Overview",
  printings: "Fields & faces",
  marketplace: "Marketplace",
  bans: "Bans & errata",
  history: "History",
};

const NAV_SECTIONS: NavCardSection[] = ["overview", "printings", "marketplace", "bans", "history"];

const ADMIN_ONLY_SECTIONS: CardSection[] = ["marketplace", "bans", "history"];

export function isCardSection(value: unknown): value is CardSection {
  return CARD_SECTIONS.some((section) => section === value);
}

export function cardSectionsFor(isAdmin: boolean): NavCardSection[] {
  return isAdmin
    ? [...NAV_SECTIONS]
    : NAV_SECTIONS.filter((section) => !ADMIN_ONLY_SECTIONS.includes(section));
}

export function navSectionOf(section: CardSection): NavCardSection {
  return section === "attention" ? "printings" : section;
}
