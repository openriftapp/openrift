import type { SetReleases } from "@openrift/shared/set-release";

import type { KeywordEntry } from "@/features/rules/lib/glossary";
import { m } from "@/paraglide/messages.js";

export interface Section {
  id: string;
  title: string;
}

interface Group {
  id: string;
  title: string;
  sections: Section[];
}

export function glossaryGroups(): Group[] {
  return [
    {
      id: "game-vocabulary",
      title: m.glossary_group_vocabulary(),
      sections: [
        { id: "domains", title: m.glossary_section_domains() },
        { id: "card-types", title: m.glossary_section_card_types() },
        { id: "keywords", title: m.glossary_section_keywords() },
        { id: "symbols", title: m.glossary_section_symbols() },
      ],
    },
    {
      id: "printing-variants",
      title: m.glossary_group_printing_variants(),
      sections: [
        { id: "rarities", title: m.glossary_section_rarities() },
        { id: "booster-packs", title: m.glossary_section_booster_packs() },
        { id: "art-variants", title: m.glossary_section_art_variants() },
        { id: "finishes", title: m.glossary_section_finishes() },
        { id: "markers", title: m.glossary_section_markers() },
        { id: "artist-and-signature", title: m.glossary_section_artist_signature() },
      ],
    },
    {
      id: "sets-and-numbering",
      title: m.glossary_group_sets_numbering(),
      sections: [
        { id: "sets", title: m.glossary_section_sets() },
        { id: "numbering", title: m.glossary_section_numbering() },
      ],
    },
  ];
}

export const DOMAIN_RULES: Record<string, string> = {
  fury: "134.2.a",
  calm: "134.2.b",
  mind: "134.2.c",
  body: "134.2.d",
  chaos: "134.2.e",
  order: "134.2.f",
};

export const CARD_TYPE_RULES: Record<string, string> = {
  unit: "140",
  gear: "147",
  spell: "152",
  rune: "159",
  battlefield: "168",
  legend: "172",
};

interface SupertypeEntry {
  slug: string;
  label: string;
  description: string;
  ruleNumber: string;
}

export function supertypeEntries(): SupertypeEntry[] {
  return [
    {
      slug: "champion",
      label: m.glossary_supertype_champion_label(),
      description: m.glossary_supertype_champion_description(),
      ruleNumber: "133.7.a",
    },
    {
      slug: "signature",
      label: m.glossary_supertype_signature_label(),
      description: m.glossary_supertype_signature_description(),
      ruleNumber: "133.7.b",
    },
    {
      slug: "token",
      label: m.glossary_supertype_token_label(),
      description: m.glossary_supertype_token_description(),
      ruleNumber: "133.7.c",
    },
  ];
}

export function artVariantDescription(slug: string): string | undefined {
  const descriptions: Record<string, () => string> = {
    normal: m.glossary_art_variant_normal,
    altart: m.glossary_art_variant_altart,
    overnumbered: m.glossary_art_variant_overnumbered,
    ultimate: m.glossary_art_variant_ultimate,
  };
  return descriptions[slug]?.();
}

export function finishDescription(slug: string): string | undefined {
  const descriptions: Record<string, () => string> = {
    normal: m.glossary_finish_normal,
    foil: m.glossary_finish_foil,
    metal: m.glossary_finish_metal,
    "metal-deluxe": m.glossary_finish_metal_deluxe,
  };
  return descriptions[slug]?.();
}

interface PackSlotEntry {
  key: string;
  label: string;
  description: string;
}

export function packSlots(): PackSlotEntry[] {
  return [
    {
      key: "common",
      label: m.glossary_pack_slot_common_label(),
      description: m.glossary_pack_slot_common_description(),
    },
    {
      key: "uncommon",
      label: m.glossary_pack_slot_uncommon_label(),
      description: m.glossary_pack_slot_uncommon_description(),
    },
    {
      key: "rare-or-better",
      label: m.glossary_pack_slot_rare_label(),
      description: m.glossary_pack_slot_rare_description(),
    },
    {
      key: "foil",
      label: m.glossary_pack_slot_foil_label(),
      description: m.glossary_pack_slot_foil_description(),
    },
    {
      key: "rune-or-token",
      label: m.glossary_pack_slot_rune_label(),
      description: m.glossary_pack_slot_rune_description(),
    },
  ];
}

interface PrintingDetailEntry {
  key: string;
  label: string;
  description: string;
}

export function printingDetails(): PrintingDetailEntry[] {
  return [
    {
      key: "artist",
      label: m.glossary_printing_detail_artist_label(),
      description: m.glossary_printing_detail_artist_description(),
    },
    {
      key: "signature",
      label: m.glossary_printing_detail_signature_label(),
      description: m.glossary_printing_detail_signature_description(),
    },
  ];
}

interface SymbolEntry {
  key: string;
  label: string;
  summary: string;
  icon?: string;
}

export function glossarySymbols(): SymbolEntry[] {
  return [
    {
      key: "might",
      label: m.glossary_symbol_might_label(),
      summary: m.glossary_symbol_might_summary(),
      icon: "/images/glyphs/might.svg",
    },
    {
      key: "might-bonus",
      label: m.glossary_symbol_might_bonus_label(),
      summary: m.glossary_symbol_might_bonus_summary(),
    },
    {
      key: "exhaust",
      label: m.glossary_symbol_exhaust_label(),
      summary: m.glossary_symbol_exhaust_summary(),
      icon: "/images/glyphs/exhaust.svg",
    },
    {
      key: "recycle",
      label: m.glossary_symbol_recycle_label(),
      summary: m.glossary_symbol_recycle_summary(),
    },
    {
      key: "power-activation",
      label: m.glossary_symbol_power_activation_label(),
      summary: m.glossary_symbol_power_activation_summary(),
    },
    {
      key: "energy",
      label: m.glossary_symbol_energy_label(),
      summary: m.glossary_symbol_energy_summary(),
    },
    {
      key: "rune-rainbow",
      label: m.glossary_symbol_rune_rainbow_label(),
      summary: m.glossary_symbol_rune_rainbow_summary(),
      icon: "/images/glyphs/rune-rainbow.svg",
    },
  ];
}

interface NumberingPattern {
  pattern: string;
  summary: string;
}

export function numberingPatterns(): NumberingPattern[] {
  return [
    { pattern: "OGN-001", summary: m.glossary_numbering_base() },
    { pattern: "OGN-120a", summary: m.glossary_numbering_altart() },
    { pattern: "OGN-224", summary: m.glossary_numbering_overnumbered() },
    { pattern: "SFD-T01", summary: m.glossary_numbering_token() },
    { pattern: "SFD-R01", summary: m.glossary_numbering_rune() },
  ];
}

export interface SetEntry {
  slug: string;
  name: string;
  releases: SetReleases;
  setType: "main" | "supplemental";
  cardCount: number;
}

export interface KeywordRow {
  name: string;
  color?: string | null;
  darkText?: boolean;
  info?: KeywordEntry;
}
