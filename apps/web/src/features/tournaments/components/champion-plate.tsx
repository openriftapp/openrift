import { imageUrl } from "@openrift/shared/image-url";
import type {
  PodStandingRow,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { legendDisplayName } from "@openrift/shared/utils";
import { Suspense } from "react";

import { ArtBandBackdrop } from "@/components/art-band-backdrop";
import { Card } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { UserAvatar } from "@/components/user-avatar";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import {
  formatPlayerRecord,
  standingRanks,
} from "@/features/tournaments/components/standings-display";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

interface Champion {
  playerId: string;
  displayName: string;
  record: string | null;
  legendCardId: string | null;
}

/** The final standings name the champion for a cut; otherwise the sole leader on points. */
export function tournamentChampion(
  run: PodTournamentDetailResponse,
  swiss: boolean,
): Champion | null {
  const byPlayer = new Map(run.standings.map((row) => [row.playerId, row]));
  const legendOf = new Map(run.players.map((player) => [player.id, player.legendCardId]));
  const build = (row: PodStandingRow | undefined, playerId: string, displayName: string) => ({
    playerId,
    displayName,
    record: row === undefined ? null : formatPlayerRecord(row, swiss),
    legendCardId: legendOf.get(playerId) ?? null,
  });

  const cutWinner = run.groupStage?.finalStandings?.[0];
  if (cutWinner !== undefined) {
    return build(byPlayer.get(cutWinner.playerId), cutWinner.playerId, cutWinner.displayName);
  }
  const played = run.standings.filter((row) => row.roundsPlayed > 0);
  const leader = played[0];
  if (leader === undefined || standingRanks(played)[1] === 1) {
    return null;
  }
  return build(leader, leader.playerId, leader.displayName);
}

function ChampionText({
  name,
  record,
  legend,
}: {
  name: string | null;
  record: string | null;
  legend: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-border-accent text-2xs font-semibold tracking-wide uppercase">
        {m.tournaments_champion_label()}
      </span>
      {name === null ? null : <p className="font-heading text-xl font-semibold">{name}</p>}
      {legend}
      {record === null ? null : (
        <p className="font-heading text-border-accent text-2xl leading-none font-bold tabular-nums">
          {record}
        </p>
      )}
    </div>
  );
}

function PlateBody({ champion }: { champion: Champion }) {
  const { printingsByCardId } = useCards();
  const printing =
    champion.legendCardId === null ? undefined : printingsByCardId.get(champion.legendCardId)?.[0];
  const image = printing?.images.find((entry) => entry.face === "front");
  const art = image === undefined ? null : imageUrl(image.imageId, "400w");
  return (
    <>
      <ArtBandBackdrop thumbnail={art} domains={printing?.card.domains ?? []} />
      <div className="relative flex items-center gap-4 p-5">
        <UserAvatar name={champion.displayName} size="lg" className="shrink-0" />
        <ChampionText
          name={champion.displayName}
          record={champion.record}
          legend={
            printing === undefined ? null : (
              <MetaIdentity
                name={legendDisplayName(printing.card)}
                slug={printing.card.slug}
                domains={printing.card.domains}
                layout="stacked"
                className="text-sm"
              />
            )
          }
        />
        {art === null ? null : (
          <ImgWithFallback
            src={art}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            fallback={null}
            style={{ borderRadius: CARD_BORDER_RADIUS }}
            className="aspect-card ml-auto hidden h-28 shrink-0 rotate-6 object-cover shadow-md sm:block"
          />
        )}
      </div>
    </>
  );
}

function PlainPlate({ champion }: { champion: Champion }) {
  return (
    <div className="relative flex items-center gap-4 p-5">
      <UserAvatar name={champion.displayName} size="lg" className="shrink-0" />
      <ChampionText name={champion.displayName} record={champion.record} legend={null} />
    </div>
  );
}

export function ChampionPlate({
  run,
  swiss,
}: {
  run: PodTournamentDetailResponse;
  swiss: boolean;
}) {
  const hydrated = useHydrated();
  const champion = tournamentChampion(run, swiss);
  if (champion === null) {
    return null;
  }
  return (
    <Card className="relative gap-0 overflow-hidden py-0">
      {hydrated && champion.legendCardId !== null ? (
        <Suspense fallback={<PlainPlate champion={champion} />}>
          <PlateBody champion={champion} />
        </Suspense>
      ) : (
        <PlainPlate champion={champion} />
      )}
    </Card>
  );
}
