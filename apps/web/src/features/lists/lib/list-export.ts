import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { sortCards } from "@openrift/shared/filters-sort";
import { mergeListEntriesByTarget } from "@openrift/shared/list-entries";
import type { SetOrderInfo } from "@openrift/shared/set-order";
import { straightenApostrophes } from "@openrift/shared/strings";
import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Currency, TradePreference } from "@openrift/shared/types/api/trade-preferences";
import { resolveEffectiveTradePreference } from "@openrift/shared/types/api/trade-preferences";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { formatCentsInLocale, formatterForMarketplace } from "@/lib/format";

const KIND_NOUN: Record<ListKind, { one: string; many: string }> = {
  card: { one: "card", many: "cards" },
  printing: { one: "printing", many: "printings" },
  // Copy lists merge identical copies into one line per printing; the count is of printings.
  copy: { one: "printing", many: "printings" },
};

function shareHeader(listName: string, kind: ListKind, count: number): string {
  const noun = count === 1 ? KIND_NOUN[kind].one : KIND_NOUN[kind].many;
  return `${listName} (${count} ${noun})`;
}

const SHARE_HEADER_SUFFIX = new RegExp(
  String.raw` \(\d+ (?:${[...new Set(Object.values(KIND_NOUN).flatMap((noun) => [noun.one, noun.many]))].join("|")})\)$`,
  "u",
);

export function isListShareHeader(line: string): boolean {
  return SHARE_HEADER_SUFFIX.test(line);
}

/** The import reads these segments back, so every non-default finish and language is named. */
function variantSuffix(entry: ListEntryDetailResponse, finishLabels: LabelMap): string {
  if (entry.kind === "card") {
    return "";
  }
  const parts = [entry.shortCode];
  if (entry.finish !== WellKnown.finish.NORMAL) {
    parts.push(enumLabel(finishLabels, entry.finish));
  }
  if (entry.language !== WellKnown.language.EN) {
    parts.push(entry.language);
  }
  return ` · ${parts.join(" · ")}`;
}

export function hasReservedCopies(entries: readonly ListEntryDetailResponse[]): boolean {
  return entries.some((entry) => entry.kind === "copy" && entry.reserved);
}

/** Apply once on the entries every format reads, not per format. */
export function withoutReservedCopies(
  entries: readonly ListEntryDetailResponse[],
): ListEntryDetailResponse[] {
  return entries.filter((entry) => entry.kind !== "copy" || !entry.reserved);
}

/** Copy entries keep their real copy id for a `copiesById` lookup; printing entries get synthetic ids the CSV writers only count. */
export function stacksFromListEntries(
  entries: readonly ListEntryDetailResponse[],
  printingsById: Readonly<Record<string, Printing>>,
  sets: readonly SetOrderInfo[],
  sidesByPrinting: ReadonlyMap<string, Printing[]> = new Map(),
): StackedEntry[] {
  const copyIdsByPrinting = new Map<string, string[]>();
  const printings = new Map<string, Printing>();
  for (const entry of entries) {
    if (entry.kind === "card") {
      continue;
    }
    const printing = printingsById[entry.printingId];
    if (!printing) {
      continue;
    }
    printings.set(entry.printingId, printing);
    const copyIds = copyIdsByPrinting.get(entry.printingId) ?? [];
    for (let index = 0; index < entry.quantity; index++) {
      copyIds.push(entry.kind === "copy" ? entry.copyId : `${entry.printingId}#${copyIds.length}`);
    }
    copyIdsByPrinting.set(entry.printingId, copyIds);
  }

  const sorted = sortCards([...printings.values()], "id", { sets });
  return sorted.map((printing) => {
    const sides = sidesByPrinting.get(printing.printingId);
    return {
      printingId: printing.printingId,
      printing,
      ...(sides && sides.length > 1 ? { sides: sides.toSorted((a, b) => a.side - b.side) } : {}),
      copyIds: copyIdsByPrinting.get(printing.printingId) ?? [],
    };
  });
}

export interface SharePricing {
  tradeDefaults: TradePreference;
  currency: Currency | null;
  /** Major units. */
  ctPriceFor?: (printingId: string) => number | undefined;
}

function tradePriceText(entry: ListEntryDetailResponse, pricing: SharePricing): string {
  const effective = resolveEffectiveTradePreference(
    entry.tradeOverride,
    pricing.tradeDefaults,
    pricing.currency,
  );
  if (effective.pricePref === "absolute") {
    if (effective.priceAbsoluteCents === null || effective.currency === null) {
      return "";
    }
    return ` · ${formatCentsInLocale(effective.priceAbsoluteCents, effective.currency)}`;
  }
  if (effective.pricePref !== "ct_zero" || entry.kind === "card") {
    return "";
  }
  const ctPrice = pricing.ctPriceFor?.(entry.printingId);
  return ctPrice === undefined ? "" : ` · ${formatterForMarketplace("cardtrader")(ctPrice)}`;
}

export function formatListShareText(
  listName: string,
  kind: ListKind,
  entries: readonly ListEntryDetailResponse[],
  shareUrl: string | null,
  finishLabels: LabelMap,
  pricing?: SharePricing,
): string {
  const display = kind === "copy" ? mergeListEntriesByTarget(entries) : entries;
  const count = display.length;
  const header = shareHeader(listName, kind, count);
  const lines = display.map((entry) => {
    const price = pricing ? tradePriceText(entry, pricing) : "";
    // A plain ASCII "x", not "×": this gets pasted into Cardmarket's wants
    // import, which only parses "2x Name" lines.
    return `${entry.quantity}x ${straightenApostrophes(entry.cardName)}${variantSuffix(entry, finishLabels)}${price}`;
  });
  const head = shareUrl ? [header, shareUrl, ""] : [header, ""];
  return [...head, ...lines].join("\n");
}
