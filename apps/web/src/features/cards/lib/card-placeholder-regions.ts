import { m } from "@/paraglide/messages.js";

export type PlaceholderField =
  | "card.name"
  | "card.domains"
  | "card.types"
  | "card.tags"
  | "card.energy"
  | "card.might"
  | "card.power"
  | "card.mightBonus"
  | "printing.printedRulesText"
  | "printing.printedEffectText"
  | "printing.flavorText"
  | "printing.rarity"
  | "printing.publicCode"
  | "printing.artist";

export interface PlaceholderRegion {
  field: PlaceholderField;
  label: string;
  /** cqw, relative to the card's container width, both axes. */
  x: number;
  y: number;
  width: number;
  height: number;
}

// These rects mirror the absolute positions in card-placeholder-image.tsx and have to move with them.
export function cardPlaceholderRegions(): readonly PlaceholderRegion[] {
  return [
    {
      field: "card.name",
      label: m.card_detail_placeholder_card_name(),
      x: 0,
      y: 77.2,
      width: 100,
      height: 12,
    },
    {
      field: "printing.printedRulesText",
      label: m.card_detail_placeholder_rules_text(),
      x: 8,
      y: 93.6,
      width: 84,
      height: 10,
    },
    {
      field: "printing.printedEffectText",
      label: m.card_detail_placeholder_effect_text(),
      x: 8,
      y: 107,
      width: 84,
      height: 11,
    },
    {
      field: "printing.flavorText",
      label: m.card_detail_placeholder_flavor_text(),
      x: 8,
      y: 119.5,
      width: 84,
      height: 6,
    },
    {
      field: "card.types",
      label: m.card_detail_placeholder_types(),
      x: 4.7,
      y: 68,
      width: 40,
      height: 8,
    },
    {
      field: "card.tags",
      label: m.card_detail_placeholder_tags(),
      x: 46,
      y: 68,
      width: 30,
      height: 8,
    },
    {
      field: "card.power",
      label: m.card_detail_info_power(),
      x: 5.5,
      y: 20.3,
      width: 6,
      height: 17.5,
    },
    {
      field: "card.energy",
      label: m.card_detail_info_energy(),
      x: 5.5,
      y: 6.6,
      width: 11.7,
      height: 11.7,
    },
    {
      field: "card.might",
      label: m.card_detail_info_might(),
      x: 76.5,
      y: 7.7,
      width: 16,
      height: 9,
    },
    {
      field: "card.mightBonus",
      label: m.card_detail_info_might_bonus(),
      x: 79,
      y: 108,
      width: 12,
      height: 5,
    },
    {
      field: "printing.publicCode",
      label: m.card_detail_placeholder_public_code(),
      x: 5,
      y: 132.9,
      width: 25,
      height: 4,
    },
    {
      field: "printing.artist",
      label: m.card_detail_info_artist(),
      x: 55,
      y: 132.9,
      width: 30,
      height: 4,
    },
    {
      field: "card.domains",
      label: m.card_detail_info_domains(),
      x: 86,
      y: 132.9,
      width: 9,
      height: 4,
    },
    {
      field: "printing.rarity",
      label: m.card_detail_info_rarity(),
      x: 46,
      y: 129.4,
      width: 8,
      height: 3.5,
    },
  ];
}
