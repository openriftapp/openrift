import { ZONE_LABELS } from "@openrift/shared/deck-zones";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";
import { m } from "@/paraglide/messages.js";

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
}: {
  entries: readonly DeckBuilderCard[];
  printingLabels?: ReadonlyMap<string, string>;
  isFreeform: boolean;
  onAdd: (entry: DeckBuilderCard) => void;
  onRemove: (entry: DeckBuilderCard) => void;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul className="grid w-fit grid-cols-[auto_auto] items-center gap-x-4 gap-y-1">
      {entries.map((entry) => (
        <li key={getDeckCardKey(entry)} className="contents">
          <span>
            {ZONE_LABELS[entry.zone]}
            {printingLabels?.has(getDeckCardKey(entry)) && (
              <span className="text-muted-foreground">
                {" · "}
                {printingLabels.get(getDeckCardKey(entry))}
              </span>
            )}
          </span>
          <InlineCountStepper
            size="sm"
            variant="outline"
            count={<span className="tabular-nums">{entry.quantity}×</span>}
            decrementLabel={m.decks_editor_remove_one_copy({ card: entry.cardName })}
            incrementLabel={m.decks_editor_add_one_copy({ card: entry.cardName })}
            onDecrement={() => onRemove(entry)}
            onIncrement={
              !isFreeform && ONE_COPY_ZONES.has(entry.zone) ? undefined : () => onAdd(entry)
            }
          />
        </li>
      ))}
    </ul>
  );
}
