import { RotateCcwIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Kbd } from "@/components/ui/kbd";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import {
  chanceToDraw,
  EARLY_DRAWS,
  formatChancePct,
  OPENING_HAND_SIZE,
} from "@/features/decks/lib/deck-draw-odds";
import { FIXTURE_CARDS } from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ClipFrame } from "./clip-frame";

const DEAL_DELAYS = [0, 130, 260, 390];

const HAND_CARD_CLASS = "aspect-card h-24 object-cover shadow-sm sm:h-28";

const MAIN_DECK_SIZE = 39;
const TURN_ONE_UNITS = 9;

const ODDS_ROWS = [
  { copies: 3, card: FIXTURE_CARDS.soulSword },
  { copies: 3, card: FIXTURE_CARDS.guards },
  { copies: 2, card: FIXTURE_CARDS.hiddenBlade },
];

function OddsCells({ copies }: { copies: number }) {
  return (
    <>
      <TableCell className="w-px text-right tabular-nums">
        {formatChancePct(chanceToDraw(copies, MAIN_DECK_SIZE, OPENING_HAND_SIZE))}
      </TableCell>
      <TableCell className="w-px text-right tabular-nums">
        {formatChancePct(chanceToDraw(copies, MAIN_DECK_SIZE, EARLY_DRAWS))}
      </TableCell>
    </>
  );
}

function HandCard({
  art,
  delay,
  selected,
  swap,
}: {
  art?: string;
  delay: number;
  selected?: boolean;
  swap?: string;
}) {
  const placeholder = (
    <span
      style={{ borderRadius: CARD_BORDER_RADIUS }}
      className="border-muted-foreground/25 aspect-card block h-24 border border-dashed sm:h-28"
    />
  );
  return (
    <span
      className="motion-safe:animate-test-deal relative inline-block"
      style={{ animationDelay: `${delay}ms`, borderRadius: CARD_BORDER_RADIUS }}
    >
      {art ? (
        <ImgWithFallback
          src={art}
          alt=""
          loading="lazy"
          draggable={false}
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          className={cn(HAND_CARD_CLASS, swap && "motion-safe:animate-test-before opacity-0")}
          fallback={placeholder}
        />
      ) : (
        placeholder
      )}
      {swap && (
        <ImgWithFallback
          fallback={null}
          src={swap}
          alt=""
          loading="lazy"
          draggable={false}
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          className={cn(HAND_CARD_CLASS, "motion-safe:animate-test-after absolute inset-0")}
        />
      )}
      {selected && (
        <span
          aria-hidden="true"
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          className="ring-primary ring-offset-background motion-safe:animate-test-select absolute inset-0 opacity-0 ring-2 ring-offset-2"
        />
      )}
    </span>
  );
}

export function TestVignette({ thumbnailUrls = [] }: { thumbnailUrls?: string[] }) {
  return (
    <ClipFrame className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className={cn(buttonVariants({ variant: "outline" }))}>
          <RotateCcwIcon className="size-4" />
          {m.decks_editor_draw_hand()}
          <Kbd className="max-sm:hidden">N</Kbd>
        </span>
        <span aria-hidden="true" className={cn(buttonVariants({ variant: "outline" }))}>
          {m.decks_editor_mulligan()}
          <Kbd className="max-sm:hidden">M</Kbd>
        </span>
        <span aria-hidden="true" className={cn(buttonVariants({ variant: "outline" }))}>
          {m.decks_editor_draw_card()}
          <Kbd className="max-sm:hidden">D</Kbd>
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {m.decks_editor_left_in_deck({ count: MAIN_DECK_SIZE - OPENING_HAND_SIZE })}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {DEAL_DELAYS.map((delay, index) => (
          <HandCard
            key={delay}
            art={thumbnailUrls[index]}
            delay={delay}
            selected={index === 1}
            swap={index === 1 ? thumbnailUrls[4] : undefined}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeading size="sm">{m.decks_odds_draw_title()}</SectionHeading>
        <Table interactive={false}>
          <TableHeader>
            <TableRow className="text-muted-foreground text-xs">
              <TableHead>{m.decks_odds_col_card()}</TableHead>
              <TableHead className="w-px text-right">{m.decks_odds_col_hand()}</TableHead>
              <TableHead className="w-px text-right">{m.decks_odds_col_first_seven()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/50">
              <TableCell className="max-w-0 truncate">
                {m.decks_odds_preset_turn_one_first_unit()}{" "}
                <span className="text-muted-foreground tabular-nums">· {TURN_ONE_UNITS}</span>
              </TableCell>
              <OddsCells copies={TURN_ONE_UNITS} />
            </TableRow>
            {ODDS_ROWS.map((row) => (
              <TableRow key={row.card.shortCode}>
                <TableCell className="max-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{row.copies}×</span>{" "}
                  {row.card.name}
                </TableCell>
                <OddsCells copies={row.copies} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground text-2xs">{m.decks_odds_draw_footnote()}</p>
      </div>
    </ClipFrame>
  );
}
