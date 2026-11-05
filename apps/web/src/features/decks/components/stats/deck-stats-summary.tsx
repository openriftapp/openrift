import { enumLabel } from "@openrift/shared/enum-label";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { useDeckStats } from "@/features/decks/hooks/use-deck-stats";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { formatChancePct } from "@/features/decks/lib/deck-draw-odds";
import { energyCurveTotals, turnOnePlayChances } from "@/features/decks/lib/deck-stats-summary";
import type { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function DeckStatsSummary({
  cards,
  stats,
  cardTypeLabels,
  onShowAll,
}: {
  cards: DeckBuilderCard[];
  stats: ReturnType<typeof useDeckStats>;
  cardTypeLabels: ReturnType<typeof useEnumOrders>["labels"]["cardTypes"];
  onShowAll: () => void;
}) {
  const curve = energyCurveTotals(stats.energyCurve, stats.energyCurveStacks);
  const maxCount = Math.max(1, ...curve.map((entry) => entry.count));
  const turnOne = turnOnePlayChances(cards, cardTypeLabels);
  if (curve.length === 0 && stats.typeBreakdown.length === 0) {
    return null;
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        {curve.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{m.decks_stats_energy()}</span>
            <div className="flex h-10 items-end gap-1" aria-hidden="true">
              {curve.map((entry) => (
                <div
                  key={entry.energy}
                  className="bg-primary min-h-px flex-1 rounded-sm"
                  style={{ height: `${(entry.count / maxCount) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              {curve.map((entry) => (
                <span
                  key={entry.energy}
                  className="text-muted-foreground text-2xs flex-1 text-center tabular-nums"
                >
                  {entry.energy}
                </span>
              ))}
            </div>
          </div>
        )}
        {turnOne && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-muted-foreground text-xs">
              {m.decks_stats_turn_one_play_label()}
            </span>
            <span>
              {m.decks_odds_going_first()}{" "}
              <span className="font-medium tabular-nums">{formatChancePct(turnOne.first)}</span>
            </span>
            <span>
              {m.decks_odds_going_second()}{" "}
              <span className="font-medium tabular-nums">{formatChancePct(turnOne.second)}</span>
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {stats.typeBreakdown.length > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {stats.typeBreakdown
                .map((entry) =>
                  m.decks_stats_type_axis({
                    count: entry.total,
                    label: enumLabel(cardTypeLabels, entry.type),
                    type: entry.type,
                  }),
                )
                .join(" · ")}
            </span>
          )}
          <Button variant="link" size="sm" className="ml-auto h-auto px-0" onClick={onShowAll}>
            {m.decks_stats_all()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
