import type { ListEntryDetailResponse, ListIntent } from "@openrift/shared/types/api/list";

import { dispatchDropFromRule } from "@/features/cards/stores/card-row-actions-store";
import { entryToDropTarget } from "@/features/rules/lib/rule-drop";
import { copyPinWording } from "@/features/rules/lib/rule-wording";
import { m } from "@/paraglide/messages.js";

/** A reserved copy gets no keep action: it stays on the list while its trade is live. */
export function ruleBadgeAction(entry: ListEntryDetailResponse, intent: ListIntent) {
  const run = () => dispatchDropFromRule(entryToDropTarget(entry));
  if (entry.kind !== "copy") {
    return { onExclude: run, excludeLabel: m.lists_entry_exclude_aria({ name: entry.cardName }) };
  }
  return entry.reserved
    ? {}
    : { keep: { handleKeep: run, label: copyPinWording(intent).pinAria(entry.cardName) } };
}

export function ruleMenuAction(entry: ListEntryDetailResponse, intent: ListIntent) {
  const run = () => dispatchDropFromRule(entryToDropTarget(entry));
  if (entry.kind !== "copy") {
    return { onExclude: run };
  }
  return entry.reserved ? {} : { keep: { handleKeep: run, label: copyPinWording(intent).pin } };
}
