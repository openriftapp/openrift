import { totalQuantity } from "@openrift/shared/deck-rules";
import { isZoneShown, ZONE_LABELS, zoneExpected } from "@openrift/shared/deck-zones";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { deckZoneFilterPreset } from "@/features/decks/lib/deck-zone-filters";
import type { ZoneChip } from "@/features/decks/lib/workbench-zone-layer";
import { zoneLayerChips } from "@/features/decks/lib/workbench-zone-layer";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useCustomTagList, useEnumOrders, useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

function useChipLabel(): (chip: ZoneChip) => string {
  const { labels } = useEnumOrders();
  const { all: customTags } = useCustomTagList();
  const customTagLabel = new Map(customTags.map((tag) => [tag.slug, tag.label]));
  return (chip) => {
    switch (chip.kind) {
      case "types": {
        return enumLabel(labels.cardTypes, chip.value);
      }
      case "superTypes": {
        return enumLabel(labels.superTypes, chip.value);
      }
      case "superTypesEx": {
        return enumLabel(labels.superTypes, chip.value);
      }
      case "domains": {
        return enumLabel(labels.domains, chip.value);
      }
      case "search": {
        return chip.value;
      }
      case "customTags": {
        return customTagLabel.get(chip.value) ?? chip.value;
      }
      case "stats": {
        return m.decks_workbench_chip_stats_paused();
      }
    }
  };
}

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
  const removed = useWorkbenchStore((state) => state.removedZoneChips);
  const removeZoneChip = useWorkbenchStore((state) => state.removeZoneChip);
  const restoreZoneChips = useWorkbenchStore((state) => state.restoreZoneChips);
  const dismissedAdvance = useWorkbenchStore((state) => state.dismissedAdvance);
  const setDismissedAdvance = useWorkbenchStore((state) => state.setDismissedAdvance);
  const chipLabel = useChipLabel();

  const isFreeform = format === WellKnown.deckFormat.FREEFORM;
  const countIn = (target: DeckZone) => totalQuantity(cards.filter((card) => card.zone === target));
  const expectedIn = (target: DeckZone) =>
    isFreeform ? undefined : zoneExpected(target, format, cards);
  const count = countIn(zone);
  const expected = expectedIn(zone);

  const chips = zoneLayerChips(deckZoneFilterPreset(zone, cards, format, formatConfig));
  const shownChips = chips.filter((chip) => !removed.has(`${zone}:${chip.key}`));
  const hiddenCount = chips.length - shownChips.length;

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
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 max-md:[scrollbar-width:none] md:flex-wrap [&>*]:shrink-0">
        <Badge variant="subtle" className="gap-1.5">
          <span className="text-muted-foreground">{m.decks_workbench_adding_to()}</span>
          <span className="font-semibold">{ZONE_LABELS[zone]}</span>
          {expected !== undefined && (
            <span className="tabular-nums">
              {count}/{expected}
            </span>
          )}
        </Badge>
        {shownChips.length > 0 && (
          <span className="text-muted-foreground">{m.decks_workbench_zone_filters()}</span>
        )}
        {shownChips.map((chip) => (
          <FilterChip
            key={chip.key}
            label={chipLabel(chip)}
            excluded={chip.kind === "superTypesEx"}
            removeLabel={m.decks_workbench_remove_zone_filter({ label: chipLabel(chip) })}
            onRemove={() => removeZoneChip(zone, chip.key)}
          />
        ))}
        {hiddenCount > 0 && (
          <Button variant="ghost" size="xs" onClick={() => restoreZoneChips(zone)}>
            {m.decks_workbench_restore_zone_filters({ count: hiddenCount })}
          </Button>
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
