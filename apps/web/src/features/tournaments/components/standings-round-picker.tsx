import { HistoryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { m } from "@/paraglide/messages.js";

/** Clamps a requested round to the finalized ones; null means the latest table. */
export function snapshotRound(requested: number | undefined, latestRound: number): number | null {
  if (requested === undefined || requested >= latestRound || requested < 1) {
    return null;
  }
  return Math.floor(requested);
}

export function StandingsRoundPicker({
  latestRound,
  selected,
  onSelect,
}: {
  latestRound: number;
  /** Null shows the latest table. */
  selected: number | null;
  onSelect: (round: number | null) => void;
}) {
  if (latestRound < 2) {
    return null;
  }
  const items = Array.from({ length: latestRound }, (_, index) => {
    const round = index + 1;
    return {
      value: String(round),
      label:
        round === latestRound
          ? m.tournaments_standings_after_round_latest({ number: round })
          : m.tournaments_standings_after_round({ number: round }),
    };
  });
  const value = String(selected ?? latestRound);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="standings-round">{m.tournaments_standings_picker_label()}</Label>
        <SimpleSelect
          id="standings-round"
          className="w-56"
          items={items}
          value={value}
          onChange={(next) => {
            const round = Number(next);
            onSelect(round === latestRound ? null : round);
          }}
        />
      </div>
      {selected === null ? null : (
        <Callout className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <HistoryIcon className="text-muted-foreground size-4 shrink-0" />
            <span>
              {m.tournaments_standings_historic_note({ round: selected, total: latestRound })}
            </span>
          </span>
          <Button onClick={() => onSelect(null)}>{m.tournaments_standings_show_latest()}</Button>
        </Callout>
      )}
    </div>
  );
}
