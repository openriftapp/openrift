import { enumLabel } from "@openrift/shared/enum-label";
import { sortCards } from "@openrift/shared/filters-sort";
import { mergeListEntriesByTarget } from "@openrift/shared/list-entries";
import type { SetOrderInfo } from "@openrift/shared/set-order";
import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Currency, TradePreference } from "@openrift/shared/types/api/trade-preferences";
import { resolveEffectiveTradePreference } from "@openrift/shared/types/api/trade-preferences";
import type { Printing } from "@openrift/shared/types/catalog";
import { straightenApostrophes } from "@openrift/shared/utils";
import { WellKnown } from "@openrift/shared/well-known";

import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { formatPrice, formatPriceEur } from "@/lib/format";

const KIND_NOUN: Record<ListKind, { one: string; many: string }> = {
  card: { one: "card", many: "cards" },
  printing: { one: "printing", many: "printings" },
  // Copy lists merge identical copies into one line per printing; the count is of printings.
  copy: { one: "printing", many: "printings" },
};

function variantSuffix(
  entry: ListEntryDetailResponse,
  siblings: readonly ListEntryDetailResponse[],
  finishLabels: Record<string, string>,
): string {
  if (entry.kind === "card") {
    return "";
  }
  const parts = [entry.shortCode];
  const finishVaries = siblings.some(
    (other) => other.kind !== "card" && other.finish !== entry.finish,
  );
  if (entry.finish !== WellKnown.finish.NORMAL && finishVaries) {
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
  return sorted.map((printing) => ({
    printingId: printing.id,
    printing,
    copyIds: copyIdsByPrinting.get(printing.id) ?? [],
  }));
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
  let value: number | undefined;
  if (effective.pricePref === "absolute") {
    if (effective.priceAbsoluteCents === null || effective.currency === null) {
      return "";
    }
    value = effective.priceAbsoluteCents / 100;
  } else if (effective.pricePref === "ct_zero" && entry.kind !== "card") {
    value = pricing.ctPriceFor?.(entry.printingId);
  }
  if (value === undefined) {
    return "";
  }
  return ` · ${pricing.currency === "EUR" ? formatPriceEur(value) : formatPrice(value)}`;
}

export function formatListShareText(
  listName: string,
  kind: ListKind,
  entries: readonly ListEntryDetailResponse[],
  shareUrl: string | null,
  finishLabels: Record<string, string>,
  pricing?: SharePricing,
): string {
  const display = kind === "copy" ? mergeListEntriesByTarget(entries) : entries;
  const count = display.length;
  const noun = count === 1 ? KIND_NOUN[kind].one : KIND_NOUN[kind].many;
  const header = `${listName} (${count} ${noun})`;
  const byCard = Map.groupBy(display, (entry) => entry.cardName);
  const lines = display.map((entry) => {
    const siblings = byCard.get(entry.cardName) ?? [entry];
    const price = pricing ? tradePriceText(entry, pricing) : "";
    // A plain ASCII "x", not "×": this gets pasted into Cardmarket's wants
    // import, which only parses "2x Name" lines.
    return `${entry.quantity}x ${straightenApostrophes(entry.cardName)}${variantSuffix(entry, siblings, finishLabels)}${price}`;
  });
  const head = shareUrl ? [header, shareUrl, ""] : [header, ""];
  return [...head, ...lines].join("\n");
}
