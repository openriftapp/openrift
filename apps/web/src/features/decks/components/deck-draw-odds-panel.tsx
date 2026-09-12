import { WellKnown } from "@openrift/shared/well-known";
import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CardOpenTarget, HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { cardHoverProps, rowActivateProps } from "@/features/cards/lib/card-row-interactions";
import type { DrawOddsRow } from "@/features/decks/lib/deck-draw-odds";
import { formatChancePct } from "@/features/decks/lib/deck-draw-odds";
import type { OddsGroupRow } from "@/features/decks/lib/deck-odds-groups";
import { oddsRowTitle } from "@/features/decks/lib/deck-odds-row-title";
import { cn } from "@/lib/utils";

function InHandDot({ inHand }: { inHand: number }) {
  if (inHand === 0) {
    return null;
  }
  return (
    <span aria-hidden className="bg-primary mr-1 inline-block size-1.5 rounded-full align-middle" />
  );
}

interface DeckDrawOddsPanelProps {
  picker: ReactNode;
  oddsRows: DrawOddsRow[];
  groupRows: OddsGroupRow[];
  inHandGroupCounts: ReadonlyMap<string, number>;
  inHandCounts: ReadonlyMap<string, string[]>;
  printingByCardId: ReadonlyMap<string, string | null>;
  showHandDots: boolean;
  onHoverCard?: HoverHandler;
  onCardClick?: (card: CardOpenTarget) => void;
}

export function DeckDrawOddsPanel({
  picker,
  oddsRows,
  groupRows,
  inHandGroupCounts,
  inHandCounts,
  printingByCardId,
  showHandDots,
  onHoverCard,
  onCardClick,
}: DeckDrawOddsPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SectionHeading size="sm">Draw odds</SectionHeading>
        {picker}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <Table interactive={false}>
          <TableHeader>
            <TableRow className="text-muted-foreground text-xs">
              <TableHead>Card</TableHead>
              <TableHead className="w-px text-right">Hand</TableHead>
              <TableHead className="w-px text-right">First 7</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Group rows first, then per-card rows below. */}
            {groupRows.map((row) => {
              const inHand = inHandGroupCounts.get(row.key) ?? 0;
              return (
                <TableRow key={row.key} className="bg-muted/50">
                  <TableCell className="max-w-0 truncate" title={oddsRowTitle(row.label, inHand)}>
                    <InHandDot inHand={inHand} />
                    {row.label}{" "}
                    <span className="text-muted-foreground tabular-nums">· {row.copies}</span>
                  </TableCell>
                  <TableCell className="w-px text-right tabular-nums">
                    {formatChancePct(row.openingChance)}
                  </TableCell>
                  <TableCell className="w-px text-right tabular-nums">
                    {formatChancePct(row.earlyChance)}
                  </TableCell>
                </TableRow>
              );
            })}
            {oddsRows.map((row) => {
              const preferredPrintingId = printingByCardId.get(row.cardId) ?? null;
              const inHand = inHandCounts.get(row.cardId)?.length ?? 0;
              const openCard = onCardClick
                ? () =>
                    onCardClick({
                      cardId: row.cardId,
                      preferredPrintingId,
                      zone: WellKnown.deckZone.MAIN,
                    })
                : undefined;
              return (
                <TableRow
                  key={row.cardId}
                  className={cn(openCard && "cursor-pointer")}
                  {...cardHoverProps(onHoverCard, row.cardId, preferredPrintingId)}
                  {...rowActivateProps(openCard)}
                >
                  <TableCell
                    className="max-w-0 truncate"
                    title={oddsRowTitle(row.cardName, inHand)}
                  >
                    <InHandDot inHand={inHand} />
                    <span className="text-muted-foreground tabular-nums">{row.copies}×</span>{" "}
                    {row.cardName}
                  </TableCell>
                  <TableCell className="w-px text-right tabular-nums">
                    {formatChancePct(row.openingChance)}
                  </TableCell>
                  <TableCell className="w-px text-right tabular-nums">
                    {formatChancePct(row.earlyChance)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-2xs">
        Chance of at least one copy in your opening hand, and anywhere in your first 7 cards.
      </p>
      {showHandDots && (
        <p className="text-muted-foreground text-2xs">Dots show what you hit in the sample hand.</p>
      )}
    </div>
  );
}
