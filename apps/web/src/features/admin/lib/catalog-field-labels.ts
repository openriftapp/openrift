import type {
  AcceptCardField,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";

export const CARD_ID_LABEL = "Card ID";

export const CARD_FIELD_LABELS: Record<AcceptCardField, string> = {
  name: "Name",
  types: "Types",
  superTypes: "Supertypes",
  domains: "Domains",
  might: "Might",
  energy: "Energy",
  power: "Power",
  mightBonus: "Might bonus",
  tags: "Tags",
  maxCopiesOverride: "Max copies override",
  additionalLegendCount: "Additional legends",
  comment: "Comment",
};

export const CARD_TEXT_FIELD_LABELS = {
  rulesText: "Rules text",
  effectText: "Effect text",
} as const;

export const PRINTING_FIELD_LABELS: Record<AcceptPrintingField, string> = {
  shortCode: "Short code",
  setId: "Set",
  rarity: "Rarity",
  artVariant: "Art variant",
  isSigned: "Signed",
  isOvernumbered: "Overnumbered",
  markerSlugs: "Markers",
  distributionChannelSlugs: "Distribution",
  finish: "Finish",
  size: "Size",
  artist: "Artist",
  publicCode: "Public code",
  printedRulesText: "Printed rules",
  printedEffectText: "Printed effect",
  flavorText: "Flavor text",
  language: "Language",
  printedName: "Printed name",
  printedYear: "Printed year",
  releasedAt: "Available from",
  releasePrecision: "Release precision",
  announcedAt: "Announced on",
  comment: "Comment",
};

export const SOURCE_COLUMN_LABELS = {
  externalId: "External ID",
  extraData: "Extra data",
  imageUrl: "Image",
} as const;

export const DIFFED_FIELDS: ReadonlySet<string> = new Set([
  "rulesText",
  "effectText",
  "printedRulesText",
  "printedEffectText",
  "flavorText",
]);
