import type { MetaLegendDetailResponse } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { DomainIcon } from "@/features/decks/components/domain-icon";
import { MetaHeroArt, MetaHeroCounter } from "@/features/meta/components/meta-hero";
import { splitLegendName } from "@/features/meta/lib/meta-format";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { deckGlowStyle } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";

type MetaLegendCounts = MetaLegendDetailResponse["counts"];

function FactCounters({ counts }: { counts: MetaLegendCounts }) {
  return (
    <div className="flex flex-wrap gap-x-9 gap-y-3">
      <MetaHeroCounter value={counts.wins} label={m.meta_legend_hero_event_wins()} />
      <MetaHeroCounter value={counts.finishes} label={m.meta_legend_hero_finishes()} />
      <MetaHeroCounter value={counts.decklists} label={m.meta_legend_hero_decklists()} />
    </div>
  );
}

export function MetaLegendHero({
  legend,
  counts,
}: {
  legend: MetaLegendDetailResponse["legend"];
  counts: MetaLegendCounts;
}) {
  const domainColors = useDomainColors();
  const { champion, title } = splitLegendName(legend.name);

  return (
    <Card className="relative gap-0 py-0">
      <div
        aria-hidden
        className="absolute inset-0"
        style={deckGlowStyle(legend.domains, domainColors)}
      />
      <MetaHeroArt imageId={legend.imageId} alt={champion} />

      <div className="relative flex flex-col gap-3 p-5 pr-[45%] sm:pr-[38%]">
        <div className="flex flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            {/* h2: the page's h1 is the champion in the top bar. */}
            <h2 className="font-heading text-2xl font-bold">
              <TextLink
                variant="inherit"
                render={
                  <Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: legend.slug }} />
                }
              >
                {champion}
              </TextLink>
            </h2>
            {legend.domains.length > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                {legend.domains.map((domain) => (
                  <DomainIcon key={domain} domain={domain} className="size-5" />
                ))}
              </span>
            )}
          </div>
          {title !== null && (
            <p className="text-muted-foreground text-sm">
              {m.meta_legend_hero_subtitle({ title })}
            </p>
          )}
        </div>

        <FactCounters counts={counts} />

        <p className="text-muted-foreground text-xs">
          {m.meta_legend_hero_description({ champion })}
        </p>
      </div>
    </Card>
  );
}
