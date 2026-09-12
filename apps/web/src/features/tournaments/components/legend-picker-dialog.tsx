import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { cardSearchLeading } from "@/features/cards/components/printing-option-content";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import { m } from "@/paraglide/messages.js";

export interface LegendTarget {
  participantId: string;
  name: string;
  legendName: string | null;
}

const isLegend = (card: Card): boolean => card.types.includes(WellKnown.cardType.LEGEND);

export function LegendPickerDialog({
  target,
  pending,
  onOpenChange,
  onPick,
}: {
  target: LegendTarget | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (participantId: string, legendCardId: string | null) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {m.tournaments_legend_picker_title({ name: target?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{m.tournaments_legend_picker_description()}</DialogDescription>
        </DialogHeader>
        {target ? (
          <Suspense
            fallback={<Input placeholder={m.tournaments_legend_picker_loading()} disabled />}
          >
            <LegendSearch onPick={(legendCardId) => onPick(target.participantId, legendCardId)} />
          </Suspense>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          {target?.legendName ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => onPick(target.participantId, null)}
            >
              {m.tournaments_legend_picker_clear()}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Split out so useCards suspends inside the boundary, not on the dialog's first render.
function LegendSearch({ onPick }: { onPick: (legendCardId: string) => void }) {
  const [search, setSearch] = useState("");
  const results = useCatalogCardSearch(search, isLegend, cardSearchLeading);
  return (
    <CardSearchDropdown
      results={results}
      onSearch={setSearch}
      onSelect={onPick}
      placeholder={m.tournaments_legend_picker_search()}
      className="w-full"
      emptyMessage={m.tournaments_legend_picker_empty()}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog opens onto this single field
      autoFocus
    />
  );
}
