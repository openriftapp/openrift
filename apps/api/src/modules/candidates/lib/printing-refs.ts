import type { AcceptPrintingBody } from "@openrift/shared/contracts/admin/card-mutations";

type PrintingFields = AcceptPrintingBody["printingFields"];

export interface UnknownPrintingRef {
  field: string;
  value: string;
}

export interface KnownPrintingRefs {
  languages: readonly string[];
  rarities: readonly string[];
  artVariants: readonly string[];
  finishes: readonly string[];
  cardSizes: readonly string[];
  markers: readonly string[];
  distributionChannels: readonly string[];
}

/** Each of these is a foreign key on `printings`, so accepting a printing that
 *  carries an unknown one aborts the whole transaction it runs in. */
export function unknownPrintingRefs(
  fields: PrintingFields,
  known: KnownPrintingRefs,
): UnknownPrintingRef[] {
  const unknown: UnknownPrintingRef[] = [];

  const single: [string, string | null | undefined, readonly string[]][] = [
    ["language", fields.language, known.languages],
    ["rarity", fields.rarity, known.rarities],
    ["art variant", fields.artVariant, known.artVariants],
    ["finish", fields.finish, known.finishes],
    ["size", fields.size, known.cardSizes],
  ];
  for (const [field, value, allowed] of single) {
    if (value !== null && value !== undefined && value !== "" && !allowed.includes(value)) {
      unknown.push({ field, value });
    }
  }

  const many: [string, readonly string[] | undefined, readonly string[]][] = [
    ["marker", fields.markerSlugs, known.markers],
    ["distribution channel", fields.distributionChannelSlugs, known.distributionChannels],
  ];
  for (const [field, values, allowed] of many) {
    for (const value of values ?? []) {
      if (!allowed.includes(value)) {
        unknown.push({ field, value });
      }
    }
  }

  return unknown;
}

export function describeUnknownRefs(unknown: readonly UnknownPrintingRef[]): string {
  return unknown.map((ref) => `${ref.field} "${ref.value}"`).join(", ");
}
