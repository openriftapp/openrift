import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";
import { Link } from "@tanstack/react-router";
import {
  ArchiveIcon,
  Building2Icon,
  CalendarIcon,
  ExternalLinkIcon,
  UsersIcon,
} from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { MetaItem } from "@/components/ui/meta-item";
import { TextLink } from "@/components/ui/text-link";
import { HeroAvatarCluster } from "@/features/tournaments/components/hero-avatar-cluster";
import {
  deckSubmissionLabels,
  effectiveStateLabels,
  tournamentKindLabel,
} from "@/features/tournaments/lib/tournament-display";
import { HERO_WASH } from "@/lib/accent-wash";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TournamentHero({ detail }: { detail: TournamentDetailResponse }) {
  const state = effectiveTournamentState(detail.startsAt, detail.endsAt, detail.status);
  const orgId = detail.host.type === "organization" ? detail.host.orgId : null;

  return (
    <div className={cn(PAGE_WIDTH.capped, "px-safe pt-4")}>
      <section className="relative overflow-hidden" style={{ backgroundImage: HERO_WASH }}>
        <div className="flex items-end gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-6 pl-5">
            <Eyebrow variant="kicker">{tournamentKindLabel(detail)}</Eyebrow>
            <Heading level={1} className="text-3xl text-balance">
              {detail.name}
            </Heading>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <MetaItem icon={CalendarIcon} truncate className="text-muted-foreground">
                {formatDayTimeLocal(detail.startsAt)}
              </MetaItem>
              <MetaItem icon={Building2Icon} truncate className="text-muted-foreground">
                {orgId ? (
                  <TextLink
                    variant="inherit"
                    render={<Link to="/organizations/$id" params={{ id: orgId }} />}
                  >
                    {detail.host.displayName}
                  </TextLink>
                ) : (
                  detail.host.displayName
                )}
              </MetaItem>
              {detail.groupSlug && detail.groupName ? (
                <MetaItem icon={UsersIcon} truncate className="text-muted-foreground">
                  <TextLink
                    variant="inherit"
                    render={<Link to="/groups/$slug" params={{ slug: detail.groupSlug }} />}
                  >
                    {detail.groupName}
                  </TextLink>
                </MetaItem>
              ) : null}
              {detail.uvsgamesEventId ? (
                <MetaItem icon={ExternalLinkIcon} truncate className="text-muted-foreground">
                  <TextLink
                    variant="inherit"
                    href={uvsgamesEventUrl(detail.uvsgamesEventId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.tournaments_hero_uvsgames()}
                  </TextLink>
                </MetaItem>
              ) : null}
              {detail.metaEventSlug ? (
                <MetaItem icon={ArchiveIcon} truncate className="text-muted-foreground">
                  <TextLink
                    variant="inherit"
                    render={<Link to="/meta/$slug" params={{ slug: detail.metaEventSlug }} />}
                  >
                    {m.tournaments_hero_meta_archive()}
                  </TextLink>
                </MetaItem>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {detail.currentRound > 0 ? (
                <Badge variant="subtle">
                  {m.tournaments_round_band_round({ number: detail.currentRound })}
                </Badge>
              ) : null}
              <Badge variant="secondary">{effectiveStateLabels()[state]}</Badge>
              <Badge variant="outline">{deckSubmissionLabels()[detail.deckSubmission]}</Badge>
              <Badge variant="outline">
                {detail.selfRegistration
                  ? m.tournaments_hero_registration_open()
                  : m.tournaments_hero_registration_closed()}
              </Badge>
            </div>
          </div>
          <div aria-hidden="true" className="relative hidden h-36 w-72 shrink-0 self-end sm:block">
            <HeroAvatarCluster
              preview={detail.participantPreview}
              totalCount={detail.participantCount}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
