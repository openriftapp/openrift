import { enumLabel } from "@openrift/shared/enum-label";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { imageUrl } from "@openrift/shared/image-url";
import { formatRecord } from "@openrift/shared/meta-standings";
import type {
  MetaEventDetail,
  MetaEventField,
  MetaEventPhase,
  MetaStandingsRow,
} from "@openrift/shared/types/api/meta";
import { ExternalLinkIcon } from "lucide-react";
import { Fragment } from "react";

import { ArtBandBackdrop } from "@/components/art-band-backdrop";
import { Eyebrow, Heading } from "@/components/heading";
import { Card } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { DateLeaf } from "@/components/ui/date-leaf";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { StatFigure } from "@/components/ui/stat-figure";
import { TextLink } from "@/components/ui/text-link";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { MetaContributors } from "@/features/meta/components/meta-contributors";
import { MetaEventStatusBadge } from "@/features/meta/components/meta-event-status-badge";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import {
  describeEventProgress,
  describeEventStructure,
} from "@/features/meta/lib/meta-event-structure";
import { metaEventWinners } from "@/features/meta/lib/meta-front-page";
import { useDeckFormatList } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

/** Every citation is printed, never collapsed behind a "+2 more". */
function EventSources({ sources }: { sources: MetaEventDetail["sources"] }) {
  return (
    <p className="text-muted-foreground text-xs">
      {m.meta_event_source({ count: sources.length })}:{" "}
      {sources.map((source, index) => (
        <Fragment key={source.id}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {source.sourceUrl === null ? (
            <span>{source.label}</span>
          ) : (
            <TextLink
              className="inline-flex items-center gap-1 font-medium"
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {source.label}
              <ExternalLinkIcon className="size-3.5" />
            </TextLink>
          )}
        </Fragment>
      ))}
    </p>
  );
}

function ChampionPlate({
  player,
  artId,
  slug,
  hasRun,
}: {
  player: MetaStandingsRow;
  artId: string | null;
  slug: string;
  hasRun: boolean;
}) {
  const record = formatRecord(player.wins, player.losses, player.draws);

  return (
    <div className="flex w-full shrink-0 items-center gap-4 sm:w-auto">
      <div className="flex w-full flex-col gap-2 sm:w-64">
        <Eyebrow variant="gold" as="span">
          {m.meta_event_header_champion()}
        </Eyebrow>
        <p className="font-heading font-semibold">
          <MetaPlayerName
            name={player.playerName}
            playerKey={player.playerKey}
            eventSlug={hasRun ? slug : undefined}
          />
        </p>
        <MetaIdentity
          legend={player.legend}
          slug={player.legend?.slug}
          archiveSlug={player.legend?.archiveSlug}
          domains={player.legend?.domains}
          layout="stacked"
          className="text-sm"
        />
        {player.champion !== null && (
          <p className="text-muted-foreground text-xs">{player.champion.name}</p>
        )}
        {record !== null && (
          <p className="font-heading text-border-accent text-2xl leading-none font-bold tabular-nums">
            {record}
          </p>
        )}
      </div>
      {artId !== null && (
        <ImgWithFallback
          src={imageUrl(artId, "240w")}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          fallback={null}
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          className="aspect-card hidden h-32 shrink-0 rotate-6 object-cover shadow-md sm:block"
        />
      )}
    </div>
  );
}

/** The flag and venue are independently optional; the tier badge lives in the top bar, not here. */
export function MetaEventHeader({
  event,
  champion,
  field,
  phases,
  slug,
}: {
  event: MetaEventDetail;
  champion: MetaStandingsRow | null;
  field: MetaEventField;
  phases: readonly MetaEventPhase[];
  slug: string;
}) {
  const { labels: formatLabels } = useDeckFormatList();
  const hydrated = useHydrated();
  const structure = describeEventStructure(phases);
  const live = event.status === "in_progress";
  const winnerLegend =
    champion?.legend ?? metaEventWinners(event).find((winner) => winner.legend !== null)?.legend;
  const artId = winnerLegend?.imageId ?? null;
  const cutLineRecord =
    field.cutLine === null
      ? null
      : formatRecord(field.cutLine.wins, field.cutLine.losses, field.cutLine.draws);
  const championHasRun = champion !== null && champion.rounds.length > 0;

  const byline: string[] = [];
  if (event.organizer !== null) {
    byline.push(m.meta_event_organized_by({ organizer: event.organizer }));
  }
  byline.push(enumLabel(formatLabels, event.format));
  if (structure.sentence !== null) {
    byline.push(structure.sentence);
  }
  const liveLine: string[] = [];
  if (live) {
    liveLine.push(describeEventProgress(field.progress, phases) ?? m.meta_event_header_round_one());
    // Relative to the reader's clock, so it only renders once hydrated.
    if (hydrated && event.sourceCheckedAt !== null) {
      liveLine.push(
        m.meta_event_header_checked({ time: formatRelativeTime(event.sourceCheckedAt) }),
      );
    }
  }

  return (
    <Card className="relative gap-0 py-0">
      {artId !== null && (
        <ArtBandBackdrop
          thumbnail={imageUrl(artId, "400w")}
          domains={winnerLegend?.domains ?? []}
        />
      )}

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex items-center gap-3">
            <DateLeaf at={event.eventDate} clock="utc" showYear />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Heading level={1}>{event.name}</Heading>
                <MetaTierBadge tier={event.tier} />
                <MetaEventStatusBadge status={event.status} />
              </div>
              {(event.country !== null || event.location !== null) && (
                <p className="font-medium">
                  <CountryFlag
                    code={event.country}
                    size="sm"
                    showCode={event.location === null}
                    className="mr-1.5 align-middle"
                  />
                  {event.location}
                </p>
              )}
              <p className="text-muted-foreground text-sm">{byline.join(" · ")}</p>
              {liveLine.length > 0 && (
                <p className="text-foreground text-sm font-medium">{liveLine.join(" · ")}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-9 gap-y-3">
            {event.playerCount !== null && (
              <StatFigure
                value={formatCount(event.playerCount)}
                label={m.meta_event_header_players()}
              />
            )}
            <StatFigure
              value={formatCount(event.playerRowCount)}
              label={m.meta_event_header_results()}
            />
            <StatFigure
              value={formatCount(event.deckCount)}
              label={m.meta_event_header_decklists()}
            />
            {cutLineRecord !== null && (
              <StatFigure value={cutLineRecord} label={m.meta_event_header_cut_record()} />
            )}
          </div>

          {(event.sources.length > 0 || event.contributors.length > 0) && (
            <div className="flex flex-col gap-1">
              {event.sources.length > 0 && <EventSources sources={event.sources} />}
              <MetaContributors contributors={event.contributors} className="text-xs" />
            </div>
          )}
        </div>

        {champion !== null && (
          <ChampionPlate player={champion} artId={artId} slug={slug} hasRun={championHasRun} />
        )}
      </div>
    </Card>
  );
}
