import { legendNameParts } from "@openrift/shared/card-name";
import { Suspense } from "react";

import { LegendFinishGrid, LegendFinishTile } from "@/components/deck-identity/legend-finish-tile";
import { SectionHeading } from "@/components/ui/section-heading";
import { useCards } from "@/features/cards/hooks/use-cards";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { finishBracketLabel, formatRank } from "@/features/meta/lib/meta-format";
import type { LegendFinish } from "@/features/tournaments/lib/player-run";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

function FinishTile({ entry, cutSize }: { entry: LegendFinish; cutSize: number | null }) {
  const { printingsByCardId } = useCards();
  const printing = printingsByCardId.get(entry.legendCardId)?.[0];
  if (printing === undefined) {
    return null;
  }
  const image = printing.images.find((face) => face.face === "front");
  return (
    <LegendFinishTile
      rank={entry.place}
      rankText={formatRank(entry.place, false)}
      rankLabel={finishBracketLabel(entry.place, false, cutSize)}
      imageId={image?.imageId ?? null}
      identity={
        <MetaIdentity
          legend={legendNameParts(printing.card)}
          slug={printing.card.slug}
          domains={printing.card.domains}
          layout="tile"
        />
      }
      player={entry.displayName}
      detail={m.meta_count_players({ count: entry.playerCount })}
    />
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
  if (!hydrated || entries.length === 0) {
    return null;
  }
  return (
    <LegendFinishGrid
      heading={<SectionHeading>{m.tournaments_legend_finishes_heading()}</SectionHeading>}
      items={entries}
      getKey={(entry) => entry.legendCardId}
      renderTile={(entry) => (
        <Suspense fallback={null}>
          <FinishTile entry={entry} cutSize={cutSize} />
        </Suspense>
      )}
    />
  );
}
