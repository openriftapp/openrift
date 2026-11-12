import { buildCodeIndex, lookupCode } from "@openrift/shared/card-search";
import { printingVariantPartsEnglish } from "@openrift/shared/printing-label";
import { matchesTextPhrase } from "@openrift/shared/search-fold";

import type { CatalogCard, CatalogPrinting, CatalogSnapshot } from "./catalog-cache.js";
import { representativePrinting } from "./catalog-cache.js";

export interface PrintingChoice {
  name: string;
  value: string;
}

/** Discord caps autocomplete responses at 25 choices of at most 100 characters. */
const MAX_CHOICES = 25;
const MAX_CHOICE_NAME = 100;
const DEFAULT_SUFFIX = " (default)";

function fitChoiceName(
  code: string,
  setName: string | undefined,
  variants: string,
  suffix: string,
): string {
  const join = (set: string | undefined) =>
    `${[code, set, variants].filter(Boolean).join(" · ")}${suffix}`;
  const full = join(setName);
  if (full.length <= MAX_CHOICE_NAME) {
    return full;
  }
  const room = (setName?.length ?? 0) - (full.length - MAX_CHOICE_NAME) - 1;
  return setName !== undefined && room > 0
    ? join(`${setName.slice(0, room)}…`)
    : `${full.slice(0, MAX_CHOICE_NAME - 1)}…`;
}

function orderedPrintings(snapshot: CatalogSnapshot, card: CatalogCard): CatalogPrinting[] {
  const printings = snapshot.printingsByCardId.get(card.id) ?? [];
  const fallback = representativePrinting(snapshot, card.id);
  if (!fallback) {
    return [];
  }
  return [fallback, ...printings.filter((printing) => printing.printingId !== fallback.printingId)];
}

export function printingVariantParts(
  snapshot: CatalogSnapshot,
  printing: CatalogPrinting,
  siblings: CatalogPrinting[],
): string[] {
  const parts = printingVariantPartsEnglish(printing, siblings, snapshot.labels);
  if (parts.length === 0 && siblings.length > 1) {
    parts.push("Standard");
  }
  return parts;
}

function printingLabel(
  snapshot: CatalogSnapshot,
  printing: CatalogPrinting,
  siblings: CatalogPrinting[],
  isDefault: boolean,
): string {
  const set = snapshot.setsById.get(printing.setId);
  const variants = printingVariantParts(snapshot, printing, siblings).join(" · ");
  return fitChoiceName(printing.publicCode, set?.name, variants, isDefault ? DEFAULT_SUFFIX : "");
}

export function printingChoices(
  snapshot: CatalogSnapshot,
  card: CatalogCard,
  query: string,
): PrintingChoice[] {
  const printings = orderedPrintings(snapshot, card);
  return printings
    .map((printing, index) => ({
      choice: {
        name: printingLabel(snapshot, printing, printings, index === 0),
        value: printing.printingId,
      },
      language: printing.language,
    }))
    .filter(({ choice, language }) =>
      matchesTextPhrase(query, [choice.name.replace(DEFAULT_SUFFIX, ""), language]),
    )
    .map(({ choice }) => choice)
    .slice(0, MAX_CHOICES);
}

export function resolvePrinting(
  snapshot: CatalogSnapshot,
  card: CatalogCard,
  input: string | undefined,
): CatalogPrinting | undefined {
  const fallback = representativePrinting(snapshot, card.id);
  const query = input?.trim();
  if (!query) {
    return fallback;
  }
  const printings = snapshot.printingsByCardId.get(card.id) ?? [];
  const codeIndex = buildCodeIndex(printings.map((printing) => ({ card, printing })));
  return (
    printings.find((printing) => printing.printingId === query) ??
    lookupCode(codeIndex, query)?.printing ??
    fallback
  );
}
