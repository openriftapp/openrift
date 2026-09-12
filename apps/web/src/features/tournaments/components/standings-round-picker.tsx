import { HistoryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Label htmlFor="standings-round">Standings</Label>
        <Select
          items={items}
          value={value}
          onValueChange={(next) => {
            if (next === null) {
              return;
            }
            const round = Number(next);
            onSelect(round === latestRound ? null : round);
          }}
        >
          <SelectTrigger id="standings-round" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected === null ? null : (
        <Callout className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <HistoryIcon className="text-muted-foreground size-4 shrink-0" />
            <span>
              Standings as they stood after round {selected} of {latestRound}. Results corrected
              since then are included.
            </span>
          </span>
          <Button onClick={() => onSelect(null)}>Show latest standings</Button>
        </Callout>
      )}
    </div>
  );
}
