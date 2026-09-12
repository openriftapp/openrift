import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { Building2Icon, CalendarIcon, UsersIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Eyebrow, Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { HeroAvatarCluster } from "@/features/tournaments/components/hero-avatar-cluster";
import {
  deckSubmissionLabels,
  effectiveStateLabels,
  effectiveTournamentState,
} from "@/features/tournaments/lib/tournament-display";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const HERO_WASH = [
  "radial-gradient(90% 130% at 85% 10%, color-mix(in oklab, var(--border-accent) 26%, transparent), transparent 62%)",
  "radial-gradient(70% 120% at 65% 100%, color-mix(in oklab, var(--violet) 14%, transparent), transparent 65%)",
  "linear-gradient(color-mix(in oklab, var(--muted) 50%, var(--background)), var(--background))",
].join(", ");

/** in_progress renders as "Live", overriding the effective-state label. */
function heroKicker(detail: TournamentDetailResponse): string {
  const kind =
    detail.playMode === "2v2"
      ? m.tournaments_hero_kind_2v2()
      : detail.pairingStyle === "pod"
        ? m.tournaments_hero_kind_pod()
        : detail.pairingStyle === "swiss"
          ? m.tournaments_hero_kind_swiss()
          : m.tournaments_hero_kind_default();
  const state = effectiveTournamentState(detail.startsAt, detail.endsAt, detail.status);
  const stateLabel =
    state === "in_progress" ? m.tournaments_hero_live() : effectiveStateLabels()[state];
  return `${kind} · ${stateLabel}`;
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}): ReactNode {
  return (
    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function TournamentHero({ detail }: { detail: TournamentDetailResponse }) {
  const state = effectiveTournamentState(detail.startsAt, detail.endsAt, detail.status);

  return (
    <div className={cn(PAGE_WIDTH.capped, "px-safe pt-4")}>
      <section className="relative overflow-hidden" style={{ backgroundImage: HERO_WASH }}>
        <div className="flex items-end gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-6 pl-5">
            <Eyebrow variant="kicker">{heroKicker(detail)}</Eyebrow>
            <Heading level={1} className="text-3xl text-balance">
              {detail.name}
            </Heading>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <MetaItem icon={CalendarIcon}>{formatDayTimeLocal(detail.startsAt)}</MetaItem>
              <MetaItem icon={Building2Icon}>
                {detail.host.type === "organization" && detail.host.orgSlug ? (
                  <TextLink
                    variant="inherit"
                    render={
                      <Link to="/organizations/$id" params={{ id: detail.host.orgId ?? "" }} />
                    }
                  >
                    {detail.host.displayName}
                  </TextLink>
                ) : (
                  detail.host.displayName
                )}
              </MetaItem>
              {detail.groupSlug ? (
                <MetaItem icon={UsersIcon}>
                  <TextLink
                    variant="inherit"
                    render={<Link to="/groups/$slug" params={{ slug: detail.groupSlug }} />}
                  >
                    {detail.groupName ?? detail.groupSlug}
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
