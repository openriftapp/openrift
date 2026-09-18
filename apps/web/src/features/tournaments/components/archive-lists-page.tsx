import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type {
  ArchiveListEligibility,
  ArchiveListParticipant,
  ArchiveListRefreshResponse,
  ArchiveListSendResponse,
  ArchiveListStanding,
  ArchiveListStateResponse,
} from "@openrift/shared/types/api/tournament";
import { uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import {
  TopBarBreadcrumbSeparator,
  TopBarBreadcrumbTrail,
} from "@/components/layout/top-bar-breadcrumb";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import {
  useRefreshTournamentArchiveLists,
  useSendTournamentArchiveLists,
  useTournamentArchiveLists,
} from "@/features/tournaments/hooks/use-tournament-archive-lists";
import { useTournamentDetail } from "@/features/tournaments/hooks/use-tournaments";
import {
  canForceArchiveList,
  planArchiveListSend,
  resolveArchiveListPick,
} from "@/features/tournaments/lib/archive-lists";
import { useArchiveListsStore } from "@/features/tournaments/stores/archive-lists-store";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const NO_STANDING = "none";

function eligibilityLabel(eligibility: ArchiveListEligibility): string {
  switch (eligibility) {
    case "ready": {
      return m.tournaments_archive_eligibility_ready();
    }
    case "unchecked": {
      return m.tournaments_archive_eligibility_unchecked();
    }
    case "no_consent": {
      return m.tournaments_archive_eligibility_no_consent();
    }
    case "no_name_consent": {
      return m.tournaments_archive_eligibility_no_name_consent();
    }
    case "withdrawn": {
      return m.tournaments_archive_eligibility_withdrawn();
    }
    case "no_list": {
      return m.tournaments_archive_eligibility_no_list();
    }
  }
}

function sentStatusLabel(status: ArchiveListStanding["sentStatus"]): string | null {
  if (status === "pending") {
    return m.tournaments_archive_status_pending();
  }
  if (status === "accepted") {
    return m.tournaments_archive_status_accepted();
  }
  if (status === "rejected") {
    return m.tournaments_archive_status_rejected();
  }
  return null;
}

function standingLabel(standing: ArchiveListStanding): string {
  const label = m.tournaments_archive_standing_option({
    rank: standing.rank,
    name: standing.playerName ?? m.tournaments_archive_unnamed(),
    wins: standing.wins ?? 0,
    losses: standing.losses ?? 0,
    draws: standing.draws ?? 0,
  });
  const status = sentStatusLabel(standing.sentStatus);
  return status === null ? label : `${label} · ${status}`;
}

function ArchiveTopBar({
  tournamentId,
  onReload,
}: {
  tournamentId: string;
  onReload?: () => void;
}) {
  const { data: tournament } = useTournamentDetail(tournamentId);
  return (
    <PageTopBarSticky width="capped">
      <PageTopBar className="gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:items-baseline">
          <TopBarBreadcrumbTrail
            segments={[
              { label: m.nav_tournaments(), link: <Link to="/tournaments" /> },
              {
                label: tournament.name,
                link: <Link to="/tournaments/$id" params={{ id: tournamentId }} />,
              },
              {
                label: m.nav_decks(),
                link: <Link to="/tournaments/$id/decks" params={{ id: tournamentId }} />,
              },
            ]}
          />
          <TopBarBreadcrumbSeparator className="hidden sm:inline" />
          <PageTopBarTitle>{m.tournaments_archive_title()}</PageTopBarTitle>
        </div>
        {onReload ? (
          <PageTopBarActions>
            <PageTopBarButton onClick={onReload}>
              <RefreshCwIcon />
              {m.tournaments_archive_reload()}
            </PageTopBarButton>
          </PageTopBarActions>
        ) : null}
      </PageTopBar>
    </PageTopBarSticky>
  );
}

function ParticipantRow({
  participant,
  standings,
}: {
  participant: ArchiveListParticipant;
  standings: ArchiveListStanding[];
}) {
  const { participantId, eligibility } = participant;
  const pick = useArchiveListsStore((state) => state.picks[participantId]);
  const forced = useArchiveListsStore((state) => state.forced[participantId] === true);
  const setPick = useArchiveListsStore((state) => state.pick);
  const setForced = useArchiveListsStore((state) => state.setForced);
  const blocked = eligibility !== "ready" && eligibility !== "unchecked";
  const value = resolveArchiveListPick(pick, participant.suggestedIdentity);
  const items = [
    { value: NO_STANDING, label: m.tournaments_archive_pick_none() },
    ...standings.map((standing) => ({ value: standing.identity, label: standingLabel(standing) })),
  ];
  const forceId = `archive-force-${participantId}`;

  return (
    <RowListItem className="flex-wrap items-start justify-between gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{participant.displayName}</span>
        <span className="text-muted-foreground text-sm">
          {eligibilityLabel(eligibility)}
          {participant.unmatchedLines > 0
            ? ` · ${m.tournaments_archive_unmatched_lines({ count: participant.unmatchedLines })}`
            : null}
        </span>
        {canForceArchiveList(eligibility) ? (
          <div className="mt-1 flex items-center gap-2">
            <Checkbox
              id={forceId}
              checked={forced}
              onCheckedChange={(checked) => setForced(participantId, checked === true)}
            />
            <Label htmlFor={forceId} className="font-normal">
              {m.tournaments_archive_force()}
            </Label>
          </div>
        ) : null}
      </div>
      {blocked ? null : (
        <Select
          items={items}
          value={value}
          onValueChange={(next) =>
            setPick(participantId, next === null || next === NO_STANDING ? null : next)
          }
        >
          <SelectTrigger
            className="w-full sm:w-80"
            aria-label={m.tournaments_archive_pick_label({ player: participant.displayName })}
          >
            <SelectValue placeholder={m.tournaments_archive_pick_placeholder()} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </RowListItem>
  );
}

function SendBar({
  tournamentId,
  participants,
  onSent,
}: {
  tournamentId: string;
  participants: ArchiveListParticipant[];
  onSent: (result: ArchiveListSendResponse) => void;
}) {
  const picks = useArchiveListsStore((state) => state.picks);
  const forced = useArchiveListsStore((state) => state.forced);
  const send = useSendTournamentArchiveLists(tournamentId);
  const plan = planArchiveListSend(participants, picks, forced);
  const blocked = plan.links.length === 0 || plan.duplicates.size > 0;

  return (
    <div className="flex flex-col gap-2">
      {plan.duplicates.size > 0 ? (
        <p className="text-destructive text-sm">{m.tournaments_archive_duplicate()}</p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        {[
          plan.leftOut > 0 ? m.tournaments_archive_summary_left_out({ count: plan.leftOut }) : null,
          plan.unmatched > 0
            ? m.tournaments_archive_summary_unmatched({ count: plan.unmatched })
            : null,
          m.tournaments_archive_resend_note(),
        ]
          .filter((line) => line !== null)
          .join(" · ")}
      </p>
      <div>
        <Button
          disabled={blocked || send.isPending}
          onClick={() => send.mutate(plan.links, { onSuccess: onSent })}
        >
          {m.tournaments_archive_send({ count: plan.links.length })}
        </Button>
      </div>
    </div>
  );
}

function EventSummary({ state }: { state: ArchiveListStateResponse }) {
  const { event, uvsgamesEventId } = state;
  if (event === null || uvsgamesEventId === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{event.name}</span>
      <span className="text-muted-foreground text-sm">
        {[event.storeName, formatDayTimeLocal(event.startAt)].filter(Boolean).join(" · ")}
      </span>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <TextLink
          href={uvsgamesEventUrl(uvsgamesEventId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
        >
          {m.tournaments_archive_view_uvsgames()}
          <ExternalLinkIcon className="size-3.5" />
        </TextLink>
        {state.metaEventSlug === null ? null : (
          <TextLink render={<Link to="/meta/$slug" params={{ slug: state.metaEventSlug }} />}>
            {m.tournaments_archive_view_archive()}
          </TextLink>
        )}
      </div>
    </div>
  );
}

function outcomeMessage(outcome: ArchiveListRefreshResponse["outcome"] | null): string | null {
  if (outcome === "not_found") {
    return m.tournaments_archive_not_found();
  }
  if (outcome === "failed") {
    return m.tournaments_archive_fetch_failed();
  }
  return null;
}

export function ArchiveListsPage({ tournamentId }: { tournamentId: string }) {
  const { data: state } = useTournamentArchiveLists(tournamentId);
  const refresh = useRefreshTournamentArchiveLists(tournamentId);
  const openTournament = useArchiveListsStore((store) => store.open);
  const [outcome, setOutcome] = useState<ArchiveListRefreshResponse["outcome"] | null>(null);
  const [result, setResult] = useState<ArchiveListSendResponse | null>(null);

  useEffect(() => {
    openTournament(tournamentId);
  }, [openTournament, tournamentId]);

  const load = () => {
    setResult(null);
    refresh.mutate(undefined, { onSuccess: (response) => setOutcome(response.outcome) });
  };
  const canLoad = state?.uvsgamesEventId !== null && state?.tournamentCompleted === true;

  return (
    <>
      <ArchiveTopBar
        tournamentId={tournamentId}
        onReload={canLoad && state?.event !== null && !refresh.isPending ? load : undefined}
      />
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4 pt-3")}>
        <PageDescription>{m.tournaments_archive_intro()}</PageDescription>
        {state === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : state.uvsgamesEventId === null ? (
          <Callout className="flex flex-col gap-1">
            <span>{m.tournaments_archive_unlinked()}</span>
            <TextLink
              render={
                <Link
                  to="/tournaments/$id/settings"
                  params={{ id: tournamentId }}
                  hash="uvsgames"
                />
              }
            >
              {m.tournaments_archive_unlinked_action()}
            </TextLink>
          </Callout>
        ) : state.tournamentCompleted ? (
          <>
            {outcomeMessage(outcome) === null ? null : <Callout>{outcomeMessage(outcome)}</Callout>}
            {state.event === null ? (
              <div>
                <Button disabled={refresh.isPending} onClick={load}>
                  {m.tournaments_archive_load()}
                </Button>
              </div>
            ) : (
              <ArchiveListsBody
                tournamentId={tournamentId}
                state={state}
                result={result}
                onSent={setResult}
              />
            )}
          </>
        ) : (
          <Callout>{m.tournaments_archive_not_ended()}</Callout>
        )}
      </div>
    </>
  );
}

function ArchiveListsBody({
  tournamentId,
  state,
  result,
  onSent,
}: {
  tournamentId: string;
  state: ArchiveListStateResponse;
  result: ArchiveListSendResponse | null;
  onSent: (result: ArchiveListSendResponse) => void;
}) {
  const final = state.event?.displayStatus === "complete";
  return (
    <>
      <EventSummary state={state} />
      {final ? null : <Callout>{m.tournaments_archive_not_final()}</Callout>}
      {final && state.standings.length === 0 ? (
        <Callout>{m.tournaments_archive_no_standings()}</Callout>
      ) : null}
      {result === null ? null : (
        <Callout variant="inset">
          {m.tournaments_archive_result({
            sent: result.sent,
            updated: result.updated,
            skipped: result.skipped.length,
          })}
        </Callout>
      )}
      {final && state.standings.length > 0 ? (
        <>
          <SectionHeading count={state.participants.length}>
            {m.tournaments_archive_players_heading()}
          </SectionHeading>
          <RowList variant="divided">
            {state.participants.map((participant) => (
              <ParticipantRow
                key={participant.participantId}
                participant={participant}
                standings={state.standings}
              />
            ))}
          </RowList>
          <SendBar tournamentId={tournamentId} participants={state.participants} onSent={onSent} />
        </>
      ) : null}
    </>
  );
}
