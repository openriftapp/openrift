import { enumLabel } from "@openrift/shared/enum-label";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OrnamentFoldGem } from "@/components/ui/ornament";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import { EnergyPowerChart } from "@/features/decks/components/stats/energy-power-chart";
import { TypeBreakdown } from "@/features/decks/components/stats/type-breakdown";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import type { DomainCount } from "@/features/decks/hooks/use-deck-stats";
import { useDeckStats } from "@/features/decks/hooks/use-deck-stats";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";
import { getDomainColor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function DomainBar({
  data,
  total,
  colors,
  className,
  interactive = true,
}: {
  data: DomainCount[];
  total: number;
  colors: Record<string, string>;
  className?: string;
  interactive?: boolean;
}) {
  const { labels } = useEnumOrders();

  if (data.length === 0 || total === 0) {
    return null;
  }

  const segments = data.filter((entry) => entry.count > 0);
  const barClass = cn("flex h-2.5 flex-1 overflow-hidden rounded-full", className);

  if (!interactive) {
    return (
      <div aria-hidden="true" className={barClass}>
        {segments.map((entry) => (
          <span
            key={entry.domain}
            className="h-full"
            style={{
              width: `${(entry.count / total) * 100}%`,
              backgroundColor: getDomainColor(entry.domain, colors),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={barClass}>
        {segments.map((entry) => (
          <Tooltip key={entry.domain}>
            <TooltipTrigger
              className="h-full"
              render={<span />}
              style={{
                width: `${(entry.count / total) * 100}%`,
                backgroundColor: getDomainColor(entry.domain, colors),
              }}
            />
            <TooltipContent side="bottom">
              {enumLabel(labels.domains, entry.domain)}: {entry.count}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function DeckStatsBody({ stats }: { stats: ReturnType<typeof useDeckStats> }) {
  return (
    <div className="space-y-3">
      <EnergyPowerChart
        energyData={stats.energyCurve}
        energyStacks={stats.energyCurveStacks}
        averageEnergy={stats.averageEnergy}
        powerData={stats.powerCurve}
        powerStacks={stats.powerCurveStacks}
        averagePower={stats.averagePower}
        revealDomainsOnHover
        showTotals
        footnote={m.decks_stats_footnote_main_only()}
      />
      <TypeBreakdown
        data={stats.typeBreakdown}
        domains={stats.typeBreakdownDomains}
        revealDomainsOnHover
        showTotals
      />
    </div>
  );
}

export function DeckStatsPanel({ deckId }: { deckId: string }) {
  // Recharts warns when it renders into a zero-sized container, so stay
  // collapsed while the sidebar is display:none on mobile.
  const defaultOpen = globalThis.matchMedia("(min-width: 768px)").matches;
  const cards = useDeckCards(deckId);
  const stats = useDeckStats(cards);
  const domainColors = useDomainColors();

  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col gap-1.5">
      <DeckZoneHeader
        label={m.decks_stats_title()}
        labelClassName="group-hover/zone-label:text-foreground shrink-0 transition-colors"
        className="group/zone-label w-full gap-1.5 text-left"
        leading={
          <OrnamentFoldGem pointerClassName="group-data-[panel-open]/zone-label:rotate-90" />
        }
        render={<CollapsibleTrigger />}
      >
        <DomainBar
          data={stats.domainDistribution}
          total={stats.totalCards}
          colors={domainColors}
          className="mx-1"
        />
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {m.decks_stats_total_cards({ count: stats.totalCards })}
        </span>
      </DeckZoneHeader>

      <CollapsibleContent>
        <DeckStatsBody stats={stats} />
      </CollapsibleContent>
    </Collapsible>
  );
}
