import { totalQuantity } from "@openrift/shared/deck-rules";
import { isZoneShown, ZONE_LABELS, zoneExpected } from "@openrift/shared/deck-zones";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { deckZoneFilterPreset } from "@/features/decks/lib/deck-zone-filters";
import { zoneLayerChips } from "@/features/decks/lib/workbench-zone-layer";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function WorkbenchZoneBar({
  deckId,
  zone,
  onTargetZone,
}: {
  deckId: string;
  zone: DeckZone;
  onTargetZone: (zone: DeckZone) => void;
}) {
  const cards = useDeckCards(deckId);
  const { data } = useDeckDetail(deckId);
  const { format, formatConfig } = data.deck;
  const { zoneOrder } = useZoneOrder();
  const showAllCards = useWorkbenchStore((state) => state.showAllCardsZones.has(zone));
  const setShowAllCards = useWorkbenchStore((state) => state.setShowAllCards);
  const dismissedAdvance = useWorkbenchStore((state) => state.dismissedAdvance);
  const setDismissedAdvance = useWorkbenchStore((state) => state.setDismissedAdvance);

  const isFreeform = format === WellKnown.deckFormat.FREEFORM;
  const countIn = (target: DeckZone) => totalQuantity(cards.filter((card) => card.zone === target));
  const expectedIn = (target: DeckZone) =>
    isFreeform ? undefined : zoneExpected(target, format, cards);
  const count = countIn(zone);
  const expected = expectedIn(zone);

  const chips = zoneLayerChips(deckZoneFilterPreset(zone, cards, format, formatConfig));
  const pausesStats = chips.some((chip) => chip.kind === "stats");

  const complete = expected !== undefined && count >= expected;
  const nextZone = complete
    ? zoneOrder.find((candidate) => {
        if (candidate === zone || !isZoneShown(candidate, format, cards)) {
          return false;
        }
        const target = expectedIn(candidate);
        return target !== undefined && countIn(candidate) < target;
      })
    : undefined;
  const showAdvance = nextZone !== undefined && dismissedAdvance !== zone;

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-muted-foreground">{m.decks_workbench_adding_to()}</span>
        <span className="text-primary font-semibold">{ZONE_LABELS[zone]}</span>
        {expected !== undefined && (
          <span className="text-muted-foreground tabular-nums">
            {count}/{expected}
          </span>
        )}
        {chips.length > 0 && (
          <>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              {showAllCards
                ? m.decks_workbench_showing_all_cards()
                : m.decks_workbench_showing_allowed_cards()}
              {!showAllCards && pausesStats && ` ${m.decks_workbench_stats_paused_note()}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2.5"
              onClick={() => setShowAllCards(zone, !showAllCards)}
            >
              {showAllCards
                ? m.decks_workbench_only_allowed_cards()
                : m.decks_workbench_show_all_cards()}
            </Button>
          </>
        )}
      </div>
      {showAdvance && nextZone && (
        <div
          role="status"
          className="border-success/40 bg-success/5 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
        >
          <CheckIcon className="text-success size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {m.decks_workbench_zone_complete({
              zone: ZONE_LABELS[zone],
              next: ZONE_LABELS[nextZone],
              count: countIn(nextZone),
              expected: expectedIn(nextZone) ?? 0,
            })}
          </span>
          <Button size="sm" onClick={() => onTargetZone(nextZone)}>
            {m.decks_workbench_go_to_zone({ zone: ZONE_LABELS[nextZone] })}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissedAdvance(zone)}>
            {m.decks_workbench_stay()}
          </Button>
        </div>
      )}
    </div>
  );
}

export function WorkbenchAddAnnouncer({ deckId }: { deckId: string }) {
  const cards = useDeckCards(deckId);
  const lastAdd = useWorkbenchStore((state) => state.lastAdd);
  return (
    <p className="sr-only" aria-live="polite">
      {lastAdd &&
        m.decks_workbench_added_announcement({
          card: lastAdd.cardName,
          zone: ZONE_LABELS[lastAdd.zone],
          count: totalQuantity(cards.filter((card) => card.zone === lastAdd.zone)),
        })}
    </p>
  );
}
