import { splitTradeCopies } from "@openrift/shared/list-rule-eval";
import type { ListIntent } from "@openrift/shared/types/api/list";
import type { ListRule, ListRuleCombine, TradeRule } from "@openrift/shared/types/list-rule";
import { PinIcon } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCopyRuleEvalContext } from "@/features/lists/hooks/use-copy-rule-eval-context";
import type { BreakdownRow } from "@/features/lists/lib/rule-keep-breakdown";
import { cardEvalScope, ruleKeepBreakdown } from "@/features/lists/lib/rule-keep-breakdown";
import { copyPinWording } from "@/features/rules/lib/rule-wording";
import { m } from "@/paraglide/messages.js";

export function RuleKeepSection({
  cardId,
  intent,
  rules,
  ruleCombine,
  onListCopyIds,
}: {
  cardId: string;
  intent: ListIntent;
  rules: readonly ListRule[];
  ruleCombine: ListRuleCombine | null;
  onListCopyIds: ReadonlySet<string>;
}) {
  const ctx = useCopyRuleEvalContext();
  const wording = copyPinWording(intent);
  const { printingsById } = useCards();
  const tradeRules = rules.filter((rule): rule is TradeRule => rule.kind === "trade");
  if (!ctx || tradeRules.length === 0) {
    return null;
  }
  const scope = cardEvalScope(cardId, ctx.catalog, ctx.ownedCopies ?? []);
  const split = splitTradeCopies(tradeRules, { ...ctx, ...scope }, ruleCombine);
  const pinned = new Set(tradeRules.flatMap((rule) => rule.keepCopyIds));
  const breakdown = ruleKeepBreakdown(cardId, scope.ownedCopies, split, onListCopyIds, pinned);
  const allRows = [...breakdown.kept, ...breakdown.onList, ...breakdown.outside];
  if (allRows.length === 0) {
    return null;
  }
  const siblings = [...new Set(allRows.map((row) => row.printingId))].flatMap((id) => {
    const printing = printingsById[id];
    return printing ? [printing] : [];
  });

  const group = (label: string, rows: BreakdownRow[]) =>
    rows.length === 0 ? null : (
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <ul className="space-y-1">
          {rows.map((row) => {
            const printing = printingsById[row.printingId];
            if (!printing) {
              return null;
            }
            return (
              <li
                key={`${row.printingId}:${row.pinned}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 text-xs">
                  <PrintingVariantLine printing={printing} siblings={siblings} />
                </span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm tabular-nums">
                  {row.pinned && (
                    <>
                      <PinIcon className="size-4" aria-hidden />
                      <span className="sr-only">{wording.pinnedMark}</span>
                    </>
                  )}
                  &times;{row.count}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <section className="space-y-2">
      <SectionHeading as="h3">{m.lists_rule_split_title()}</SectionHeading>
      {group(wording.heldBack, breakdown.kept)}
      {group(wording.included, breakdown.onList)}
      {group(m.lists_rule_split_outside(), breakdown.outside)}
    </section>
  );
}
