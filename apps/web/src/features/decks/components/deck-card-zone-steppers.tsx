import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { deckCardKey } from "@/features/decks/lib/deck-builder-card";
import { useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

function displayNameOf(entry: DeckBuilderCard): string {
  return legendDisplayName({ name: entry.cardName, types: entry.cardTypes, tags: entry.tags });
}

const ONE_COPY_ZONES = new Set<DeckZone>([
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.CHAMPION,
  WellKnown.deckZone.BATTLEFIELD,
  WellKnown.deckZone.LEGEND_OPTIONS,
]);

export function DeckCardZoneSteppers({
  entries,
  isFreeform,
  onAdd,
  onRemove,
  printingLabels,
  canIncrement,
}: {
  entries: readonly DeckBuilderCard[];
  canIncrement: (entry: DeckBuilderCard) => boolean;
  printingLabels?: ReadonlyMap<string, string>;
  isFreeform: boolean;
  onAdd: (entry: DeckBuilderCard) => void;
  onRemove: (entry: DeckBuilderCard) => void;
}) {
  const { zoneLabels } = useZoneOrder();
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul className="grid w-fit grid-cols-[auto_auto] items-center gap-x-4 gap-y-1">
      {entries.map((entry) => (
        <li key={deckCardKey(entry)} className="contents">
          <span>
            {enumLabel(zoneLabels, entry.zone)}
            {printingLabels?.has(deckCardKey(entry)) && (
              <span className="text-muted-foreground">
                {" · "}
                {printingLabels.get(deckCardKey(entry))}
              </span>
            )}
          </span>
          <InlineCountStepper
            size="sm"
            variant="outline"
            count={<span className="tabular-nums">{entry.quantity}×</span>}
            decrementLabel={m.decks_editor_remove_one_copy({ card: displayNameOf(entry) })}
            incrementLabel={m.decks_editor_add_one_copy({ card: displayNameOf(entry) })}
            onDecrement={() => onRemove(entry)}
            onIncrement={
              (!isFreeform && ONE_COPY_ZONES.has(entry.zone)) || !canIncrement(entry)
                ? undefined
                : () => onAdd(entry)
            }
          />
        </li>
      ))}
    </ul>
  );
}
