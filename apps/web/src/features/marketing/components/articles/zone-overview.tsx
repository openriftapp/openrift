import {
  battlefieldCapFor,
  MAIN_DECK_SIZE,
  RUNE_TARGET,
  SIDEBOARD_MAXIMUM,
} from "@openrift/shared/deck-rules";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { ReactNode } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useZoneOrder } from "@/hooks/use-enums";

const MAIN_DECK_WITH_CHAMPION = MAIN_DECK_SIZE + 1;

const ZONE_FACTS: Partial<Record<DeckZone, { count: string; color: string }>> = {
  legend: { count: "1", color: "text-warning" },
  champion: { count: "1", color: "text-violet" },
  runes: { count: String(RUNE_TARGET), color: "text-info" },
  battlefield: {
    count: String(battlefieldCapFor(WellKnown.deckFormat.CONSTRUCTED)),
    color: "text-success",
  },
  main: { count: String(MAIN_DECK_WITH_CHAMPION), color: "text-foreground" },
  sideboard: { count: `0–${SIDEBOARD_MAXIMUM}`, color: "text-muted-foreground" },
};

export function ZoneOverview({
  descriptions,
}: {
  descriptions: Partial<Record<DeckZone, ReactNode>>;
}) {
  const { zoneOrder, zoneLabels } = useZoneOrder();
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      {zoneOrder.map((zone) => {
        const facts = ZONE_FACTS[zone];
        const description = descriptions[zone];
        if (!facts || description === undefined) {
          return null;
        }
        return (
          <Card key={zone}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className={facts.color}>{enumLabel(zoneLabels, zone)}</span>
                <span className="bg-muted text-muted-foreground text-2xs rounded-full px-1.5 tabular-nums">
                  {facts.count}
                </span>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
