import { WellKnown } from "@openrift/shared/well-known";
import { useState } from "react";

import { ExpandToggle } from "@/components/ui/expand-toggle";
import { InfoHint } from "@/components/ui/info-hint";
import { StatStrip } from "@/components/ui/stat-strip";
import type { StatStripItem } from "@/components/ui/stat-strip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SECTION_SCROLL_MARGIN } from "@/features/decks/components/deck-overview-tabs";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import { ChartHeading } from "@/features/decks/components/stats/chart-heading";
import { EnergyChart, PowerChart } from "@/features/decks/components/stats/energy-power-chart";
import { LensBar } from "@/features/decks/components/stats/lens-bar";
import { TypeBreakdown } from "@/features/decks/components/stats/type-breakdown";
import { useDeckStats } from "@/features/decks/hooks/use-deck-stats";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { curveOutRate } from "@/features/decks/lib/deck-curve-out";
import { formatChancePct } from "@/features/decks/lib/deck-draw-odds";
import { oddsGroupPresets, oddsGroupRow } from "@/features/decks/lib/deck-odds-groups";
import { NO_CARDS } from "@/features/decks/lib/deck-overview-derive";
import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import type { DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import {
  buildOwnershipRows,
  buildRarityByCardKey,
  buildRarityRows,
  ownershipFocusKeys,
  ownershipLensSeries,
  rarityFocusKeys,
  rarityLensSeries,
} from "@/features/decks/lib/deck-stat-lenses";
import type { StatsFocus } from "@/features/decks/lib/deck-stats-focus";
import { cardMatchesStatsFocus } from "@/features/decks/lib/deck-stats-focus";
import type { StatsLens } from "@/features/decks/stores/deck-builder-ui-store";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import type { useEnumOrders } from "@/hooks/use-enums";
import { useMeasuredWidth } from "@/hooks/use-measured-width";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type OwnedPrinting = ReturnType<DeckOwnershipData["ownedPrintingByCardId"]["get"]>;

export function DeckStatsBand({
  cards,
  stats,
  ownershipData,
  ownershipSegmentsByCardKey,
  ownedPrintingFor,
  enumLabels,
  enumOrders,
  statsFocus,
  applyStatsFocus,
  statsOpen,
  onStatsOpenChange,
}: {
  cards: DeckBuilderCard[];
  stats: ReturnType<typeof useDeckStats>;
  ownershipData?: DeckOwnershipData;
  ownershipSegmentsByCardKey?: ReadonlyMap<string, OwnershipBandSegments>;
  ownedPrintingFor: (cardId: string) => OwnedPrinting;
  enumLabels: ReturnType<typeof useEnumOrders>["labels"];
  enumOrders: ReturnType<typeof useEnumOrders>["orders"];
  statsFocus: StatsFocus | null;
  applyStatsFocus: (focus: StatsFocus) => void;
  /** Hydration-gated by the host; SSR always renders the band open. Keep the gate there, not here. */
  statsOpen: boolean;
  onStatsOpenChange: (open: boolean) => void;
}) {
  const hasMultiTypeCards = cards.some(
    (card) =>
      (card.zone === WellKnown.deckZone.MAIN || card.zone === WellKnown.deckZone.CHAMPION) &&
      card.cardTypes.length > 1,
  );

  const hasStats =
    stats.energyCurve.length > 0 || stats.powerCurve.length > 0 || stats.typeBreakdown.length > 0;

  const focusedCards = statsFocus
    ? cards.filter((card) => cardMatchesStatsFocus(card, statsFocus))
    : NO_CARDS;
  const focusedStats = useDeckStats(focusedCards);

  const rarityByCardKey = ownershipData
    ? buildRarityByCardKey(
        cards,
        (card) =>
          (
            ownedPrintingFor(card.cardId) ??
            ownershipData.byCardZone.get(`${card.cardId}:${card.zone}`)?.displayPrinting
          )?.rarity,
      )
    : undefined;
  const rarityRows = rarityByCardKey
    ? buildRarityRows(cards, rarityByCardKey, enumOrders.rarities, enumLabels.rarities)
    : undefined;
  const raritySeries = rarityRows ? rarityLensSeries(rarityRows, enumLabels.rarities) : [];
  const rarityHitRows =
    statsFocus && statsFocus.kind !== "rarity" && rarityByCardKey
      ? buildRarityRows(focusedCards, rarityByCardKey, enumOrders.rarities, enumLabels.rarities)
      : undefined;

  const ownershipRows = ownershipSegmentsByCardKey
    ? buildOwnershipRows(cards, ownershipSegmentsByCardKey)
    : undefined;
  const ownershipHitRows =
    statsFocus && statsFocus.kind !== "ownership" && ownershipSegmentsByCardKey
      ? buildOwnershipRows(focusedCards, ownershipSegmentsByCardKey)
      : undefined;

  const [statsChartsEl, setStatsChartsEl] = useState<HTMLDivElement | null>(null);
  const statsChartsWidth = useMeasuredWidth(statsChartsEl);
  const rarityLensAvailable = rarityRows !== undefined && rarityRows.length > 0;
  const ownershipLensAvailable = ownershipRows !== undefined;
  const lensOptions: { key: StatsLens; label: string }[] = [
    ...(stats.typeBreakdown.length > 0
      ? [{ key: "types" as const, label: m.decks_stats_types() }]
      : []),
    ...(rarityLensAvailable ? [{ key: "rarity" as const, label: m.decks_stats_rarity() }] : []),
    ...(ownershipLensAvailable
      ? [{ key: "ownership" as const, label: m.decks_stats_collection() }]
      : []),
  ];
  const storedStatsLens = useDeckBuilderUiStore((state) => state.statsLens);
  const setStatsLens = useDeckBuilderUiStore((state) => state.setStatsLens);
  const statsLens = lensOptions.some((option) => option.key === storedStatsLens)
    ? storedStatsLens
    : (lensOptions[0]?.key ?? "types");
  const chartTracks = [
    { present: stats.energyCurve.length > 0, track: "1.5fr", minWidth: 260 },
    { present: stats.powerCurve.length > 0, track: "1.5fr", minWidth: 260 },
    { present: stats.typeBreakdown.length > 0, track: "1fr", minWidth: 170 },
    { present: rarityLensAvailable || ownershipLensAvailable, track: "1fr", minWidth: 200 },
  ].filter((chart) => chart.present);
  const statsGap = 40;
  const wideMinWidth =
    chartTracks.reduce((sum, chart) => sum + chart.minWidth, 0) +
    (chartTracks.length - 1) * statsGap;
  const hasLensCharts = lensOptions.length > 1;
  const wideStats = hasLensCharts && statsChartsWidth >= wideMinWidth;

  const typesChart = (withHeading: boolean) =>
    stats.typeBreakdown.length > 0 ? (
      <TypeBreakdown
        data={stats.typeBreakdown}
        domains={stats.typeBreakdownDomains}
        revealDomainsOnHover
        showTotals
        onBarClick={(value) => applyStatsFocus({ kind: "type", value })}
        footnote={hasMultiTypeCards ? m.decks_stats_footnote_multi_type() : undefined}
        focusValue={statsFocus?.kind === "type" ? statsFocus.value : null}
        hitData={statsFocus && statsFocus.kind !== "type" ? focusedStats.typeBreakdown : undefined}
        hideHeading={!withHeading}
      />
    ) : null;

  const rarityChart = (withHeading: boolean) =>
    rarityRows && rarityLensAvailable ? (
      <LensBar
        title={withHeading ? m.decks_stats_rarity() : undefined}
        rows={rarityRows}
        series={raritySeries}
        onSegmentClick={(value) => {
          if (!rarityByCardKey) {
            return;
          }
          applyStatsFocus({
            kind: "rarity",
            value,
            cardKeys: rarityFocusKeys(cards, rarityByCardKey, value),
          });
        }}
        focusValue={statsFocus?.kind === "rarity" ? statsFocus.value : null}
        hitRows={rarityHitRows}
      />
    ) : null;

  const ownershipSeries = ownershipLensSeries();
  const ownershipChart = (withHeading: boolean) =>
    ownershipRows ? (
      <LensBar
        title={withHeading ? m.decks_stats_collection() : undefined}
        rows={ownershipRows}
        series={ownershipSeries}
        footnote={m.decks_stats_footnote_collection()}
        onSegmentClick={(value) => {
          if (!ownershipSegmentsByCardKey) {
            return;
          }
          const ownershipClass = ownershipSeries.find((series) => series.key === value)?.key;
          if (!ownershipClass) {
            return;
          }
          applyStatsFocus({
            kind: "ownership",
            value: ownershipClass,
            cardKeys: ownershipFocusKeys(cards, ownershipSegmentsByCardKey, ownershipClass),
          });
        }}
        focusValue={statsFocus?.kind === "ownership" ? statsFocus.value : null}
        hitRows={ownershipHitRows}
      />
    ) : null;

  const energyChartNode =
    stats.energyCurve.length > 0 ? (
      <EnergyChart
        data={stats.energyCurve}
        stacks={stats.energyCurveStacks}
        average={stats.averageEnergy}
        revealDomainsOnHover
        footnote={m.decks_stats_footnote_energy()}
        showTotals
        onBarClick={(value) => applyStatsFocus({ kind: "energy", value })}
        focusValue={statsFocus?.kind === "energy" ? statsFocus.value : null}
        hitData={statsFocus && statsFocus.kind !== "energy" ? focusedStats.energyCurve : undefined}
      />
    ) : null;

  const powerChartNode =
    stats.powerCurve.length > 0 ? (
      <PowerChart
        data={stats.powerCurve}
        stacks={stats.powerCurveStacks}
        average={stats.averagePower}
        showTotals
        onBarClick={(value) => applyStatsFocus({ kind: "power", value })}
        focusValue={statsFocus?.kind === "power" ? statsFocus.value : null}
        hitData={statsFocus && statsFocus.kind !== "power" ? focusedStats.powerCurve : undefined}
      />
    ) : null;

  const lensBarsNode =
    rarityLensAvailable || ownershipLensAvailable ? (
      <div className="flex flex-col gap-4">
        {rarityChart(true)}
        {ownershipChart(true)}
      </div>
    ) : null;
  const wideCells = [
    { key: "energy", node: energyChartNode },
    { key: "power", node: powerChartNode },
    { key: "types", node: typesChart(true) },
    { key: "lenses", node: lensBarsNode },
  ].filter((cell) => cell.node !== null);

  const thirdSlotNode = hasLensCharts ? (
    <div>
      <ChartHeading
        control={
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[statsLens]}
            onValueChange={([next]) => {
              if (next) {
                setStatsLens(next as StatsLens);
              }
            }}
          >
            {lensOptions.map((option) => (
              <ToggleGroupItem key={option.key} value={option.key}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      {statsLens === "types"
        ? typesChart(false)
        : statsLens === "rarity"
          ? rarityChart(false)
          : ownershipChart(false)}
    </div>
  ) : (
    (typesChart(true) ?? rarityChart(true) ?? ownershipChart(true))
  );
  const narrowCells = [
    { key: "energy", node: energyChartNode },
    { key: "power", node: powerChartNode },
    { key: "slot", node: thirdSlotNode },
  ].filter((cell) => cell.node !== null);

  const statsCharts = (
    <div
      ref={setStatsChartsEl}
      className={cn("grid gap-x-10 gap-y-4", !wideStats && "@lg:grid-cols-2 @3xl:grid-cols-3")}
      style={
        wideStats
          ? { gridTemplateColumns: chartTracks.map((chart) => chart.track).join(" ") }
          : undefined
      }
    >
      {(wideStats ? wideCells : narrowCells).map((cell) => (
        <div key={cell.key} className="min-w-0">
          {cell.node}
        </div>
      ))}
    </div>
  );

  const presets = oddsGroupPresets(cards, enumLabels.cardTypes);
  const turnOneFirst = presets.find((preset) => preset.key === "turn-one-first");
  const turnOneSecond = presets.find((preset) => preset.key === "turn-one-second");
  const turnOneFirstChance = turnOneFirst ? oddsGroupRow(cards, turnOneFirst).openingChance : null;
  const turnOneSecondChance = turnOneSecond
    ? oddsGroupRow(cards, turnOneSecond).openingChance
    : null;
  const curveOutFirst = curveOutRate(cards, { goingSecond: false });
  const curveOutSecond = curveOutRate(cards, { goingSecond: true });
  const headlineItems: StatStripItem[] = [
    ...(turnOneFirstChance !== null && turnOneSecondChance !== null
      ? [
          {
            key: "turn-one",
            value: `${formatChancePct(turnOneFirstChance)} · ${formatChancePct(turnOneSecondChance)}`,
            label: (
              <span className="inline-flex items-center gap-1">
                {m.decks_stats_turn_one_play_label()}
                <InfoHint label={m.decks_stats_turn_one_play_label()} side="bottom">
                  {m.decks_stats_turn_one_play_hint()}
                </InfoHint>
              </span>
            ),
          },
        ]
      : []),
    ...(curveOutFirst !== null && curveOutSecond !== null
      ? [
          {
            key: "curve-out",
            value: `${formatChancePct(curveOutFirst)} · ${formatChancePct(curveOutSecond)}`,
            label: (
              <span className="inline-flex items-center gap-1">
                {m.decks_stats_curve_out_label()}
                <InfoHint label={m.decks_stats_curve_out_label()} side="bottom">
                  {m.decks_stats_curve_out_hint()}
                </InfoHint>
              </span>
            ),
          },
        ]
      : []),
  ];

  if (!hasStats) {
    return null;
  }

  return (
    <div
      id="deck-stats"
      style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}
      className="flex flex-col gap-4"
    >
      <DeckZoneHeader
        label={m.decks_stats_title()}
        labelClassName="group-hover/zone-label:text-foreground transition-colors"
        labelRender={
          <ExpandToggle
            expanded={statsOpen}
            chevronClassName="size-3.5"
            onClick={() => onStatsOpenChange(!statsOpen)}
            className="group/zone-label flex-1"
          />
        }
      >
        <InfoHint label={m.decks_stats_about_label()} side="bottom">
          {m.decks_stats_about_hint()}
        </InfoHint>
      </DeckZoneHeader>
      {statsOpen && (
        <div className="flex flex-col gap-6">
          <StatStrip items={headlineItems} />
          {statsCharts}
        </div>
      )}
    </div>
  );
}
