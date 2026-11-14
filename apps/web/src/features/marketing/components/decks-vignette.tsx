import { DEFAULT_DOMAIN_COLORS } from "@openrift/shared/domain-colors";
import { enumLabel } from "@openrift/shared/enum-label";
import { CheckIcon, ChevronRightIcon, CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { EnergyGlyph, PowerPips } from "@/features/decks/components/deck-stat-glyphs";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import { deckFormatBadgeState } from "@/features/decks/lib/deck-format-badge-state";
import type { FixtureCard } from "@/features/marketing/lib/vignette-fixtures";
import {
  FIXTURE_CARDS,
  FIXTURE_DECK,
  FIXTURE_LABELS,
} from "@/features/marketing/lib/vignette-fixtures";
import { getDomainColor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { Swap, Vignette } from "./vignette-parts";

interface DeckRowData {
  card: FixtureCard;
  energy: number;
  power: number;
  owned: number;
  quantity: number;
}

const DECK_ROWS: DeckRowData[] = [
  { card: FIXTURE_CARDS.defy, energy: 1, power: 1, owned: 3, quantity: 3 },
  { card: FIXTURE_CARDS.soulSword, energy: 1, power: 0, owned: 3, quantity: 3 },
  { card: FIXTURE_CARDS.hiddenBlade, energy: 2, power: 1, owned: 3, quantity: 3 },
];

const TAIL_ROW: DeckRowData = {
  card: FIXTURE_CARDS.viPeacekeeper,
  energy: 5,
  power: 1,
  owned: 1,
  quantity: 1,
};

const ADDED_ROW = { card: FIXTURE_CARDS.guards, energy: 3, power: 0, owned: 1 };

const FORMAT_LABEL = enumLabel(FIXTURE_LABELS.formats, FIXTURE_DECK.formatSlug);

// Includes the champion, so columns total 40, not the zone's 39. Column 3's
// before/after counts both average to the printed Ø 2.3.
const ENERGY_CURVE: { energy: number; count: number; was?: number }[] = [
  { energy: 0, count: 0 },
  { energy: 1, count: 15 },
  { energy: 2, count: 13 },
  { energy: 3, count: 4, was: 3 },
  { energy: 4, count: 4 },
  { energy: 5, count: 1 },
  { energy: 6, count: 3 },
  { energy: 7, count: 0 },
  { energy: 8, count: 0 },
];

const CURVE_PEAK = 15;

// Matches the 14px top margin the real chart leaves for its column labels.
const CURVE_LABEL_HEIGHT = "0.875rem";

// A dual-domain card counts for both domains, so the split overruns the 40
// it divides by; the bar clips it.
const DOMAIN_SPLIT = [
  { domain: "calm", count: 23 },
  { domain: "order", count: 20 },
] as const;

const MAIN_DECK_SIZE = 39;

const STATS_DECK_SIZE = 40;

const AVERAGE_ENERGY =
  ENERGY_CURVE.reduce((sum, bar) => sum + bar.energy * bar.count, 0) / STATS_DECK_SIZE;

function SettledFormatBadge() {
  return (
    <Badge variant="success">
      <CheckIcon className="size-3" aria-hidden="true" />
      {FORMAT_LABEL}
    </Badge>
  );
}

function InvalidFormatBadge() {
  const { progress } = deckFormatBadgeState({
    format: FIXTURE_DECK.formatSlug,
    totalCards: 55,
    requiredProgress: 55,
    requiredTotal: 56,
    isValid: false,
  });
  return (
    <Badge variant="warning">
      {FORMAT_LABEL}
      {progress && <span className="tabular-nums">· {progress}</span>}
      <CircleAlertIcon className="size-3" aria-hidden="true" />
    </Badge>
  );
}

function ZoneCount({ quantity, complete }: { quantity: number; complete?: boolean }) {
  return (
    <span className={cn("tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
      {quantity}/{MAIN_DECK_SIZE}
    </span>
  );
}

function Ownership({ owned, needed }: { owned: number; needed: number }) {
  return (
    <span className={cn("tabular-nums", owned < needed ? "text-warning" : "text-muted-foreground")}>
      {owned}/{needed}
    </span>
  );
}

function DeckRow({
  card,
  quantity,
  power,
  energy,
  ownership,
}: {
  card: FixtureCard;
  quantity: ReactNode;
  power: number;
  energy: number;
  ownership: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm sm:gap-2">
      <CardMiniRow
        className="self-stretch"
        domains={card.domains}
        rarity={card.rarity}
        shortCode={card.shortCode}
        hideMetaOnMobile
      />
      <span className="w-6 shrink-0 text-right tabular-nums">{quantity}</span>
      <span className="min-w-0 flex-1 truncate">{card.name}</span>
      <PowerPips
        power={power}
        domains={card.domains}
        colors={DEFAULT_DOMAIN_COLORS}
        domainLabels={FIXTURE_LABELS.domains}
      />
      <EnergyGlyph value={energy} />
      <span className="w-10 shrink-0 text-right text-xs">{ownership}</span>
    </li>
  );
}

function CurveBar({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("flex h-full flex-col justify-end", className)}>
      <span className="text-muted-foreground text-2xs h-3.5 text-center leading-none tabular-nums">
        {count > 0 && count}
      </span>
      <span
        className="bg-primary w-full"
        style={{ height: `calc((100% - ${CURVE_LABEL_HEIGHT}) * ${count / CURVE_PEAK})` }}
      />
    </span>
  );
}

function CurveColumn({ count, was }: { count: number; was?: number }) {
  const swaps = was !== undefined;
  return (
    <span className="relative flex h-full min-w-0 flex-1 flex-col">
      <CurveBar count={count} className={cn(swaps && "motion-safe:animate-vignette-now")} />
      {swaps && (
        <CurveBar
          count={was}
          className="motion-safe:animate-vignette-was absolute inset-0 opacity-0"
        />
      )}
    </span>
  );
}

export function DecksVignette() {
  return (
    <Vignette>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{FIXTURE_DECK.name}</span>
        <Swap
          className="justify-items-end"
          was={<InvalidFormatBadge />}
          now={<SettledFormatBadge />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <DeckZoneHeader label={enumLabel(FIXTURE_LABELS.zones, "main")}>
          <span className="ml-auto text-xs">
            <Swap
              className="justify-items-end"
              was={<ZoneCount quantity={MAIN_DECK_SIZE - 1} />}
              now={<ZoneCount quantity={MAIN_DECK_SIZE} complete />}
            />
          </span>
        </DeckZoneHeader>

        <ul className="flex flex-col">
          {DECK_ROWS.map((row) => (
            <DeckRow
              key={row.card.shortCode}
              card={row.card}
              quantity={`${row.quantity}×`}
              power={row.power}
              energy={row.energy}
              ownership={<Ownership owned={row.owned} needed={row.quantity} />}
            />
          ))}
          <DeckRow
            card={ADDED_ROW.card}
            quantity={<Swap className="justify-items-end" was="1×" now="2×" />}
            power={ADDED_ROW.power}
            energy={ADDED_ROW.energy}
            ownership={
              <Swap
                className="justify-items-end"
                was={<Ownership owned={ADDED_ROW.owned} needed={1} />}
                now={<Ownership owned={ADDED_ROW.owned} needed={2} />}
              />
            }
          />
          <DeckRow
            card={TAIL_ROW.card}
            quantity={`${TAIL_ROW.quantity}×`}
            power={TAIL_ROW.power}
            energy={TAIL_ROW.energy}
            ownership={<Ownership owned={TAIL_ROW.owned} needed={TAIL_ROW.quantity} />}
          />
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground flex h-6 items-center gap-1.5">
          <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0 rotate-90" />
          <span className="text-2xs shrink-0 font-semibold tracking-wide uppercase">
            {m.decks_stats_title()}
          </span>
          <span aria-hidden="true" className="mx-1 flex h-2.5 flex-1 overflow-hidden rounded-full">
            {DOMAIN_SPLIT.map((entry) => (
              <span
                key={entry.domain}
                className="h-full"
                style={{
                  width: `${(entry.count / STATS_DECK_SIZE) * 100}%`,
                  backgroundColor: getDomainColor(entry.domain),
                }}
              />
            ))}
          </span>
          <span className="shrink-0 text-xs tabular-nums">
            <Swap
              className="justify-items-end"
              was={m.common_cards({ count: STATS_DECK_SIZE - 1 })}
              now={m.common_cards({ count: STATS_DECK_SIZE })}
            />
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-center text-xs">
            <span className="font-medium">{m.decks_stats_energy()}</span>
            <span className="text-muted-foreground ml-auto">{`Ø ${AVERAGE_ENERGY.toFixed(1)}`}</span>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {ENERGY_CURVE.map((bar) => (
              <CurveColumn key={bar.energy} count={bar.count} was={bar.was} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {ENERGY_CURVE.map((bar) => (
              <span
                key={bar.energy}
                className="text-muted-foreground text-2xs min-w-0 flex-1 text-center tabular-nums"
              >
                {bar.energy}
              </span>
            ))}
          </div>
          <span className="text-muted-foreground text-2xs">
            {m.decks_stats_footnote_main_only()}
          </span>
        </div>
      </div>
    </Vignette>
  );
}
