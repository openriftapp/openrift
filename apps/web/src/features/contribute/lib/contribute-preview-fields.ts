import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import type {
  ContributeFormPrinting,
  ContributeFormState,
} from "@/features/contribute/lib/contribute-json";
import { m } from "@/paraglide/messages.js";

const PRINTING_ERROR_PATH = /^printings\[(?<index>\d+)\]\.(?<key>.+)$/u;

function errorLabels(): Record<string, string> {
  return {
    "card.name": m.contribute_field_card_name(),
    "card.types": m.contribute_field_types(),
    "card.superTypes": m.contribute_field_supertypes(),
    "card.domains": m.contribute_field_domains(),
    "card.might": m.contribute_field_might(),
    "card.energy": m.contribute_field_energy(),
    "card.power": m.contribute_field_power(),
    "card.mightBonus": m.contribute_field_might_bonus(),
    "card.tags": m.contribute_field_tags(),
    slug: m.contribute_field_card_name(),
    publicCode: m.contribute_field_code(),
    setId: m.contribute_field_set(),
    setName: m.contribute_field_set(),
    rarity: m.contribute_field_rarity(),
    artVariant: m.contribute_field_art_variant(),
    finish: m.contribute_field_finish(),
    size: m.contribute_field_size(),
    artist: m.contribute_field_artist(),
    printedName: m.contribute_field_printed_name(),
    printedRulesText: m.contribute_field_rules_text(),
    printedEffectText: m.contribute_field_effect_text(),
    printedYear: m.contribute_field_year(),
    flavorText: m.contribute_field_flavor_text(),
    imageUrl: m.contribute_field_image_url(),
    language: m.contribute_field_language(),
    markerSlugs: m.contribute_field_markers(),
    distributionChannelSlugs: m.contribute_field_channels(),
  };
}

const FIELD_BY_ERROR_KEY: Record<string, PlaceholderField> = {
  "card.name": "card.name",
  "card.types": "card.types",
  "card.domains": "card.domains",
  "card.might": "card.might",
  "card.energy": "card.energy",
  "card.power": "card.power",
  "card.mightBonus": "card.mightBonus",
  "card.tags": "card.tags",
  slug: "card.name",
  publicCode: "printing.publicCode",
  rarity: "printing.rarity",
  artist: "printing.artist",
  printedRulesText: "printing.printedRulesText",
  printedEffectText: "printing.printedEffectText",
  flavorText: "printing.flavorText",
};

/** Reads a validation path like `printings[2].publicCode` as something a contributor can act on. */
export function errorLabel(path: string): string {
  const labels = errorLabels();
  const match = PRINTING_ERROR_PATH.exec(path);
  if (!match?.groups) {
    return labels[path] ?? path;
  }
  const { index, key } = match.groups;
  return m.contribute_error_printing_field({
    number: Number(index) + 1,
    label: labels[key ?? ""] ?? key ?? "",
  });
}

/** The preview region a validation path points at, when the card shows that field at all. */
export function errorField(path: string): PlaceholderField | null {
  const match = PRINTING_ERROR_PATH.exec(path);
  const key = match?.groups?.key ?? path;
  return FIELD_BY_ERROR_KEY[key] ?? null;
}

export function errorPrintingIndex(path: string): number | null {
  const index = PRINTING_ERROR_PATH.exec(path)?.groups?.index;
  return index === undefined ? null : Number(index);
}

function printingFilled(printing: ContributeFormPrinting | undefined): PlaceholderField[] {
  if (!printing) {
    return [];
  }
  const out: PlaceholderField[] = [];
  if (printing.printedRulesText?.trim()) {
    out.push("printing.printedRulesText");
  }
  if (printing.printedEffectText?.trim()) {
    out.push("printing.printedEffectText");
  }
  if (printing.flavorText?.trim()) {
    out.push("printing.flavorText");
  }
  if (printing.rarity) {
    out.push("printing.rarity");
  }
  if (printing.publicCode?.trim()) {
    out.push("printing.publicCode");
  }
  if (printing.artist?.trim()) {
    out.push("printing.artist");
  }
  return out;
}

/** Which preview regions currently show real data. */
export function filledPreviewFields(
  form: ContributeFormState,
  activePrinting: number | null,
): Set<PlaceholderField> {
  const { card } = form;
  const out: PlaceholderField[] = [];
  if (card.name.trim()) {
    out.push("card.name");
  }
  if (card.domains.length > 0) {
    out.push("card.domains");
  }
  if (card.types.length > 0 || card.superTypes.length > 0) {
    out.push("card.types");
  }
  if (card.tags.length > 0) {
    out.push("card.tags");
  }
  if (card.energy !== null) {
    out.push("card.energy");
  }
  if (card.might !== null) {
    out.push("card.might");
  }
  if (card.power !== null) {
    out.push("card.power");
  }
  if (card.mightBonus !== null) {
    out.push("card.mightBonus");
  }
  return new Set([...out, ...printingFilled(form.printings[activePrinting ?? 0])]);
}
