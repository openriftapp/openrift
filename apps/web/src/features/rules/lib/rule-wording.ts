import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import type { ListRuleCombine, TradeKeepPer } from "@openrift/shared/types/list-rule";
import type { FilterRange } from "@openrift/shared/types/search";

import { m } from "@/paraglide/messages.js";

/**
 * A rule's shape follows the list's kind (card/printing lists match the catalog,
 * copy lists draw on owned copies); the words around it follow the list's intent.
 */
export interface RuleWording {
  isCopy: boolean;
  description: string;
  emptyMessage: string;
  quantityLabel: (keepPer: TradeKeepPer) => string;
  quantityHint: (keepPer: TradeKeepPer) => string;
  groupLabel: string;
  combineOptions: readonly { value: ListRuleCombine; label: string }[];
  combineHint: (combine: ListRuleCombine) => string;
  countVerb: (netOwned: boolean) => string;
}

type RuleNoun = "card" | "printing";

function quantityCombineLabels(): readonly { value: ListRuleCombine; label: string }[] {
  return [
    { value: "sum", label: m.lists_rule_wording_combine_sum() },
    { value: "max", label: m.lists_rule_wording_combine_max() },
  ];
}

function tradeCombineLabels(): readonly { value: ListRuleCombine; label: string }[] {
  return [
    { value: "protect", label: m.lists_rule_wording_combine_trade_protect() },
    { value: "count-sum", label: m.lists_rule_wording_combine_trade_count_sum() },
    { value: "count-max", label: m.lists_rule_wording_combine_trade_count_max() },
  ];
}

function organizeCopyCombineLabels(): readonly { value: ListRuleCombine; label: string }[] {
  return [
    { value: "protect", label: m.lists_rule_wording_combine_organize_protect() },
    { value: "count-sum", label: m.lists_rule_wording_combine_organize_count_sum() },
    { value: "count-max", label: m.lists_rule_wording_combine_organize_count_max() },
  ];
}

const wishWording = (noun: RuleNoun): Omit<RuleWording, "isCopy"> => ({
  description: m.lists_rule_wording_wish_description(),
  emptyMessage: m.lists_rule_wording_wish_empty(),
  quantityLabel: () => m.lists_rule_wording_wish_quantity_label(),
  quantityHint: () =>
    noun === "printing"
      ? m.lists_rule_wording_wish_quantity_hint_printing()
      : m.lists_rule_wording_wish_quantity_hint_card(),
  groupLabel: "",
  combineOptions: quantityCombineLabels(),
  combineHint: (combine) => {
    if (combine === "max") {
      return noun === "printing"
        ? m.lists_rule_wording_wish_combine_hint_max_printing()
        : m.lists_rule_wording_wish_combine_hint_max_card();
    }
    return noun === "printing"
      ? m.lists_rule_wording_wish_combine_hint_sum_printing()
      : m.lists_rule_wording_wish_combine_hint_sum_card();
  },
  countVerb: (netOwned) =>
    netOwned ? m.lists_rule_wording_verb_missing() : m.lists_rule_wording_verb_matches(),
});

const tradeWording = (): Omit<RuleWording, "isCopy"> => ({
  description: m.lists_rule_wording_trade_description(),
  emptyMessage: m.lists_rule_wording_trade_empty(),
  quantityLabel: (keepPer) =>
    keepPer === "printing"
      ? m.lists_rule_wording_trade_quantity_label_printing()
      : m.lists_rule_wording_trade_quantity_label_card(),
  quantityHint: (keepPer) =>
    keepPer === "printing"
      ? m.lists_rule_wording_trade_quantity_hint_printing()
      : m.lists_rule_wording_trade_quantity_hint_card(),
  groupLabel: m.lists_rule_wording_trade_group_label(),
  combineOptions: tradeCombineLabels(),
  combineHint: (combine) => {
    if (combine === "count-sum") {
      return m.lists_rule_wording_trade_combine_hint_count_sum();
    }
    if (combine === "count-max") {
      return m.lists_rule_wording_trade_combine_hint_count_max();
    }
    return m.lists_rule_wording_trade_combine_hint_protect();
  },
  // Copy rules never net owned copies, so the verb doesn't vary.
  countVerb: () => m.lists_rule_wording_verb_offers(),
});

const organizeCardWording = (noun: RuleNoun): Omit<RuleWording, "isCopy"> => ({
  description: m.lists_rule_wording_organize_description(),
  emptyMessage: m.lists_rule_wording_organize_empty(),
  quantityLabel: () => m.lists_rule_wording_organize_quantity_label(),
  quantityHint: () =>
    noun === "printing"
      ? m.lists_rule_wording_organize_quantity_hint_printing()
      : m.lists_rule_wording_organize_quantity_hint_card(),
  groupLabel: "",
  combineOptions: quantityCombineLabels(),
  combineHint: (combine) => {
    if (combine === "max") {
      return noun === "printing"
        ? m.lists_rule_wording_organize_combine_hint_max_printing()
        : m.lists_rule_wording_organize_combine_hint_max_card();
    }
    return noun === "printing"
      ? m.lists_rule_wording_organize_combine_hint_sum_printing()
      : m.lists_rule_wording_organize_combine_hint_sum_card();
  },
  countVerb: (netOwned) =>
    netOwned ? m.lists_rule_wording_verb_missing() : m.lists_rule_wording_verb_matches(),
});

/**
 * Reuses the trade list's keep/offer split, but nothing is offered here, so
 * held-back copies read as "left out" instead.
 */
const organizeCopyWording = (): Omit<RuleWording, "isCopy"> => ({
  description: m.lists_rule_wording_organize_copy_description(),
  emptyMessage: m.lists_rule_wording_organize_copy_empty(),
  quantityLabel: (keepPer) =>
    keepPer === "printing"
      ? m.lists_rule_wording_organize_copy_quantity_label_printing()
      : m.lists_rule_wording_organize_copy_quantity_label_card(),
  quantityHint: (keepPer) =>
    keepPer === "printing"
      ? m.lists_rule_wording_organize_copy_quantity_hint_printing()
      : m.lists_rule_wording_organize_copy_quantity_hint_card(),
  groupLabel: m.lists_rule_wording_organize_copy_group_label(),
  combineOptions: organizeCopyCombineLabels(),
  combineHint: (combine) => {
    if (combine === "count-sum") {
      return m.lists_rule_wording_organize_copy_combine_hint_count_sum();
    }
    if (combine === "count-max") {
      return m.lists_rule_wording_organize_copy_combine_hint_count_max();
    }
    return m.lists_rule_wording_organize_copy_combine_hint_protect();
  },
  countVerb: () => m.lists_rule_wording_verb_includes(),
});

export function ruleWording(intent: ListIntent, kind: ListKind): RuleWording {
  const isCopy = kind === "copy";
  const noun: RuleNoun = kind === "printing" ? "printing" : "card";
  if (intent === "organize") {
    return { ...(isCopy ? organizeCopyWording() : organizeCardWording(noun)), isCopy };
  }
  return { ...(isCopy ? tradeWording() : wishWording(noun)), isCopy };
}

/** Pluralized rule-count label, e.g. "42 cards" / "1 printing" / "3 copies". */
export function matchLabel(count: number, kind: ListKind): string {
  const isOne = count === 1;
  if (kind === "card") {
    return isOne ? m.common_cards_one({ count }) : m.common_cards_other({ count });
  }
  if (kind === "printing") {
    return isOne ? m.common_printings_one({ count }) : m.common_printings_other({ count });
  }
  return isOne ? m.common_copies_one({ count }) : m.common_copies_other({ count });
}

export function netOwnedHint(price: FilterRange): string {
  const base = m.lists_rule_wording_net_owned_hint();
  if (price.min === null && price.max === null) {
    return base;
  }
  return `${base} ${m.lists_rule_wording_net_owned_hint_price()}`;
}

export function ruleCountLabel(
  count: number,
  kind: ListKind,
  wording: RuleWording,
  netOwned: boolean,
): string {
  return m.lists_rule_wording_count_label({
    verb: wording.countVerb(netOwned),
    matches: matchLabel(count, kind),
  });
}
