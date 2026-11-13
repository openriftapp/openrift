import { filterCards } from "@openrift/shared/filters";
import type { CardSearchContext } from "@openrift/shared/filters-shared";
import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ListRule } from "@openrift/shared/types/list-rule";
import type { CardFilters } from "@openrift/shared/types/search";

/**
 * The card/printing/copy a user picked to drop from a list's dynamic rules.
 * Exactly the id matching `kind` is set; the others are absent.
 */
export interface RuleDropTarget {
  kind: ListKind;
  cardId?: string;
  printingId?: string;
  copyId?: string;
}

export function entryToDropTarget(entry: ListEntryDetailResponse): RuleDropTarget {
  if (entry.kind === "card") {
    return { kind: "card", cardId: entry.cardId };
  }
  if (entry.kind === "printing") {
    return { kind: "printing", printingId: entry.printingId };
  }
  return { kind: "copy", copyId: entry.copyId };
}

function wishRuleMatches(
  filter: CardFilters,
  target: RuleDropTarget,
  catalog: Printing[],
  context: CardSearchContext,
): boolean {
  const matched = filterCards(catalog, filter, { ...context, strict: true });
  if (target.kind === "card") {
    return matched.some((printing) => printing.cardId === target.cardId);
  }
  return matched.some((printing) => printing.printingId === target.printingId);
}

/**
 * Excludes a card/printing from every wish rule still matching it, or pins a copy on every trade
 * rule. Returns null when nothing would change.
 */
export function dropEntryFromRules(
  rules: ListRule[],
  target: RuleDropTarget,
  catalog: Printing[],
  context: CardSearchContext,
): ListRule[] | null {
  let changed = false;
  const next = rules.map((rule): ListRule => {
    if (rule.kind === "wish") {
      const id = target.kind === "card" ? target.cardId : target.printingId;
      if (
        !id ||
        rule.excludeIds.includes(id) ||
        !wishRuleMatches(rule.filter, target, catalog, context)
      ) {
        return rule;
      }
      changed = true;
      return { ...rule, excludeIds: [...rule.excludeIds, id] };
    }
    if (target.kind !== "copy" || !target.copyId || rule.keepCopyIds.includes(target.copyId)) {
      return rule;
    }
    changed = true;
    return { ...rule, keepCopyIds: [...rule.keepCopyIds, target.copyId] };
  });
  return changed ? next : null;
}
