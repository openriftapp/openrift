import { enumLabel } from "@openrift/shared/enum-label";
import { useState } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PowerDomainIcon } from "@/features/decks/components/deck-card-row";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { formatChancePct } from "@/features/decks/lib/deck-draw-odds";
import { buildRuneOddsRows, RUNE_ODDS_TURNS } from "@/features/decks/lib/deck-rune-odds";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";

// Runes are their own shuffled deck; this deliberately reads the real deck's
// rune zone and ignores the sideboard experiment, since runes can't be swapped.
export function DeckRuneOddsPanel({ cards }: { cards: DeckBuilderCard[] }) {
  const [goingSecond, setGoingSecond] = useState(false);
  const domainColors = useDomainColors();
  const { labels } = useEnumOrders();
  const rows = buildRuneOddsRows(cards, { goingSecond });
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SectionHeading size="sm">Rune odds</SectionHeading>
        <ToggleGroup
          variant="outline"
          spacing={0}
          size="sm"
          value={[goingSecond ? "second" : "first"]}
          onValueChange={([next]) => setGoingSecond(next === "second")}
          aria-label="Play order"
          className="ml-auto"
        >
          <ToggleGroupItem value="first">Going first</ToggleGroupItem>
          <ToggleGroupItem value="second">Going second</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <Table interactive={false}>
          <TableHeader>
            <TableRow className="text-muted-foreground text-xs">
              <TableHead>Runes</TableHead>
              {RUNE_ODDS_TURNS.map((turn) => (
                <TableHead key={turn} className="w-px text-right">
                  Turn {turn}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.domain}-${row.threshold}`}>
                <TableCell className="max-w-0">
                  <span className="flex items-center gap-1.5">
                    <PowerDomainIcon domains={[row.domain]} colors={domainColors} />
                    <span className="truncate">
                      {row.threshold}+ {enumLabel(labels.domains, row.domain)}
                    </span>
                  </span>
                </TableCell>
                {row.byTurn.map((chance, index) => (
                  <TableCell key={RUNE_ODDS_TURNS[index]} className="w-px text-right tabular-nums">
                    {/* 0 is structurally impossible; show a dash, not 0%. */}
                    {chance === 0 ? (
                      <span className="text-muted-foreground/60">–</span>
                    ) : (
                      formatChancePct(chance)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-2xs">
        Chance of having channeled at least that many runes of a domain by the end of each turn. You
        channel two runes a turn{goingSecond ? ", plus one more on your first turn" : ""}.
      </p>
    </div>
  );
}
