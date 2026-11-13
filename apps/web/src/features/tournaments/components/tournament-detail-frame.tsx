import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import type { TopBarCrumb } from "@/components/layout/top-bar-breadcrumb";
import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { TournamentHero } from "@/features/tournaments/components/tournament-hero";
import { useTournamentDetail } from "@/features/tournaments/hooks/use-tournaments";
import { canManageTournament } from "@/features/tournaments/lib/tournament-display";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type TournamentTab =
  | "overview"
  | "participants"
  | "pairings"
  | "standings"
  | "decks"
  | "my-deck"
  | "staff"
  | "settings";

export type TournamentSection = Exclude<TournamentTab, "overview">;

function tournamentSectionLabels(): Record<TournamentSection, string> {
  return {
    participants: m.tournaments_section_participants(),
    pairings: m.tournaments_section_pairings(),
    standings: m.tournaments_section_standings(),
    // "Decks" is the judging queue (every entrant); "My deck" is the player's own.
    decks: m.tournaments_section_decks(),
    "my-deck": m.tournaments_section_my_deck(),
    staff: m.tournaments_section_staff(),
    settings: m.tournaments_section_settings(),
  };
}

export function TournamentBreadcrumbBar({
  id,
  trail = [],
  title,
  actions,
  children,
}: {
  id: string;
  trail?: TopBarCrumb[];
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { data } = useTournamentDetail(id);
  const atTournament = title === undefined && trail.length === 0;

  return (
    <TopBarBreadcrumbBar
      segments={[
        { label: m.nav_tournaments(), link: <Link to="/tournaments" /> },
        atTournament
          ? { label: data.name }
          : { label: data.name, link: <Link to="/tournaments/$id" params={{ id }} /> },
        ...trail,
      ]}
      title={title}
      actions={actions}
    >
      {children}
    </TopBarBreadcrumbBar>
  );
}

export function tournamentDecksCrumb(id: string): TopBarCrumb {
  return {
    label: m.nav_decks(),
    link: <Link to="/tournaments/$id/decks" params={{ id }} />,
  };
}

/**
 * The overview has no title in its bar: the hero below is the title row, so
 * the bar keeps only the breadcrumb trail and the organizers' Settings shortcut.
 */
export function TournamentOverviewFrame({
  id,
  render,
}: {
  id: string;
  render: (data: TournamentDetailResponse) => ReactNode;
}) {
  const { data } = useTournamentDetail(id);
  const manage = canManageTournament(data.myRoles);

  return (
    <>
      <TournamentBreadcrumbBar
        id={id}
        actions={
          manage ? (
            <PageTopBarButton render={<Link to="/tournaments/$id/settings" params={{ id }} />}>
              <SettingsIcon />
              {m.tournaments_section_settings()}
            </PageTopBarButton>
          ) : undefined
        }
      />
      <TournamentHero detail={data} />
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-8 pt-6", PAGE_PADDING_NO_TOP)}>
        {render(data)}
      </div>
    </>
  );
}

export function TournamentSectionFrame({
  id,
  section,
  actions,
  render,
}: {
  id: string;
  section: TournamentSection;
  actions?: ReactNode;
  render: (data: TournamentDetailResponse) => ReactNode;
}) {
  const { data } = useTournamentDetail(id);

  return (
    <TournamentBreadcrumbBar id={id} title={tournamentSectionLabels()[section]} actions={actions}>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        {render(data)}
      </div>
    </TournamentBreadcrumbBar>
  );
}
