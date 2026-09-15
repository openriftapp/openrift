import { imageUrl } from "@openrift/shared/image-url";
import { legendDisplayName } from "@openrift/shared/utils";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";
import { SectionHeading } from "@/components/ui/section-heading";
import { useCards } from "@/features/cards/hooks/use-cards";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { finishBracketLabel, formatRank } from "@/features/meta/lib/meta-format";
import type { LegendFinish } from "@/features/tournaments/lib/player-run";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const TILES_SHOWN = 8;

function FinishTile({ entry, cutSize }: { entry: LegendFinish; cutSize: number | null }) {
  const { printingsByCardId } = useCards();
  const printing = printingsByCardId.get(entry.legendCardId)?.[0];
  if (printing === undefined) {
    return null;
  }
  const image = printing.images.find((face) => face.face === "front");
  return (
    <Card
      size="sm"
      className={cn("h-full gap-0 py-0", rankBandRingClass(rankBandTone(entry.place, true)))}
    >
      <RankBand
        layout="inline"
        rank={entry.place}
        text={formatRank(entry.place, false)}
        label={finishBracketLabel(entry.place, false, cutSize)}
      />
      <div className="flex items-center gap-3 p-3">
        {image === undefined ? null : (
          <ImgWithFallback
            src={imageUrl(image.imageId, "240w")}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            fallback={null}
            className="aspect-card w-13 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <MetaIdentity
            name={legendDisplayName(printing.card)}
            slug={printing.card.slug}
            domains={printing.card.domains}
            layout="tile"
          />
          <div className="flex min-w-0 flex-col text-xs leading-tight">
            <span className="min-w-0 truncate font-medium">{entry.displayName}</span>
            <span className="text-muted-foreground tabular-nums">
              {entry.playerCount} player{entry.playerCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TournamentLegendFinishes({
  entries,
  cutSize = null,
}: {
  entries: LegendFinish[];
  cutSize?: number | null;
}) {
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  if (!hydrated || entries.length === 0) {
    return null;
  }
  const shown = expanded ? entries : entries.slice(0, TILES_SHOWN);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SectionHeading>{m.tournaments_legend_finishes_heading()}</SectionHeading>
        {entries.length > TILES_SHOWN ? (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? m.tournaments_legend_show_fewer()
              : m.tournaments_legend_show_all({ count: entries.length })}
          </Button>
        ) : null}
      </div>
      <Suspense fallback={null}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((entry) => (
            <li key={entry.legendCardId}>
              <FinishTile entry={entry} cutSize={cutSize} />
            </li>
          ))}
        </ul>
      </Suspense>
    </section>
  );
}
