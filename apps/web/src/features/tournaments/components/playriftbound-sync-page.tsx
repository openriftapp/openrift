import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type {
  PlayriftboundSyncPayload,
  PlayriftboundSyncRegistrant,
} from "@openrift/shared/playriftbound-sync";
import {
  parsePlayriftboundDeckText,
  playriftboundRiotId,
  summarizePlayriftboundSync,
} from "@openrift/shared/playriftbound-sync";
import type {
  PlayriftboundSyncResponse,
  TournamentSummaryResponse,
} from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsSection } from "@/components/layout/settings-section";
import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveError } from "@/features/tournaments/components/save-error";
import { HostField } from "@/features/tournaments/components/settings/host-field";
import { NameField } from "@/features/tournaments/components/settings/name-field";
import { usePlayriftboundHandoff } from "@/features/tournaments/hooks/use-playriftbound-handoff";
import {
  usePlayriftboundTargets,
  useSyncPlayriftbound,
} from "@/features/tournaments/hooks/use-playriftbound-sync";
import { useCreateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const NEW_TOURNAMENT = "new";

function registrantStatus(registrant: PlayriftboundSyncRegistrant): string {
  if (registrant.dropped) {
    return m.tournaments_playriftbound_status_dropped();
  }
  if (registrant.deck === null) {
    return m.tournaments_playriftbound_status_no_deck();
  }
  const skipped = parsePlayriftboundDeckText(registrant.deck.deckText).skipped.length;
  return skipped === 0
    ? m.tournaments_playriftbound_status_deck()
    : m.tournaments_playriftbound_status_unreadable({ count: skipped });
}

function targetDescription(item: TournamentSummaryResponse): string {
  const when = formatDayTimeLocal(item.startsAt);
  return item.deckSubmission === "none"
    ? `${when} · ${m.tournaments_playriftbound_target_no_decks()}`
    : when;
}

function SyncResult({ result }: { result: PlayriftboundSyncResponse }) {
  return (
    <Callout className="flex flex-col gap-2">
      <p className="font-medium">{m.tournaments_playriftbound_done_title()}</p>
      <p className="text-muted-foreground">
        {m.tournaments_playriftbound_done_players({
          created: result.participantsCreated,
          updated: result.participantsUpdated,
          left: result.participantsLeft,
        })}
      </p>
      <p className="text-muted-foreground">
        {m.tournaments_playriftbound_done_decks({
          created: result.decksCreated,
          updated: result.decksUpdated,
          unchanged: result.decksUnchanged,
        })}
      </p>
      {result.decksKept > 0 ? (
        <p className="text-muted-foreground">
          {m.tournaments_playriftbound_done_kept({ count: result.decksKept })}
        </p>
      ) : null}
      <div>
        <Link
          to="/tournaments/$id/decks"
          params={{ id: result.tournamentId }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {m.tournaments_playriftbound_done_open()}
        </Link>
      </div>
    </Callout>
  );
}

function SyncForm({ payload }: { payload: PlayriftboundSyncPayload }) {
  const { data: targets } = usePlayriftboundTargets(payload.event.eventId);
  const createTournament = useCreateTournament();
  const syncPlayriftbound = useSyncPlayriftbound();
  const [picked, setPicked] = useState<string>();
  const [name, setName] = useState(payload.event.name.slice(0, 120));
  const [hostValue, setHostValue] = useState("user");
  const [result, setResult] = useState<PlayriftboundSyncResponse>();
  const summary = summarizePlayriftboundSync(payload);

  const items = targets?.items ?? [];
  const target = picked ?? targets?.linkedIds[0] ?? (targets ? NEW_TOURNAMENT : undefined);
  const pickedItem = items.find((item) => item.id === target);
  const canSync =
    target !== undefined &&
    (target === NEW_TOURNAMENT ? name.trim() !== "" : pickedItem?.deckSubmission !== "none");
  const pending = createTournament.isPending || syncPlayriftbound.isPending;

  async function handleSync() {
    if (target === undefined) {
      return;
    }
    await runReportedMutation(async () => {
      let tournamentId = target;
      if (target === NEW_TOURNAMENT) {
        const created = await createTournament.mutateAsync({
          name: name.trim(),
          host:
            hostValue === "user" ? { type: "user" } : { type: "organization", orgId: hostValue },
          pairingStyle: "none",
          deckSubmission: "required",
          startsAt: payload.event.startsAt,
        });
        tournamentId = created.id;
        setPicked(created.id);
      }
      setResult(await syncPlayriftbound.mutateAsync({ tournamentId, payload }));
    });
  }

  return (
    <>
      <SettingsGroup id="event" title={payload.event.name}>
        <SettingsSection
          title={m.tournaments_playriftbound_event_title()}
          description={m.tournaments_playriftbound_event_description({
            date: formatDayTimeLocal(payload.event.startsAt),
            read: formatDayTimeLocal(payload.readAt),
          })}
        >
          <p>
            {m.tournaments_playriftbound_event_counts({
              players: summary.registrants,
              decks: summary.decks,
              dropped: summary.dropped,
            })}
          </p>
          {summary.unreadable > 0 ? (
            <p className="text-warning">
              {m.tournaments_playriftbound_event_unreadable({ count: summary.unreadable })}
            </p>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={m.tournaments_playriftbound_target_title()}
          description={m.tournaments_playriftbound_target_description()}
          contentClassName="gap-3"
        >
          {targets === undefined ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <RadioGroup value={target} onValueChange={(value) => setPicked(String(value))}>
              {items.map((item) => (
                <RadioOptionRow
                  key={item.id}
                  value={item.id}
                  title={item.name}
                  description={targetDescription(item)}
                  disabled={item.deckSubmission === "none"}
                  meta={
                    targets.linkedIds.includes(item.id) ? (
                      <Badge variant="subtle">{m.tournaments_playriftbound_target_linked()}</Badge>
                    ) : null
                  }
                />
              ))}
              <RadioOptionRow
                value={NEW_TOURNAMENT}
                title={m.tournaments_playriftbound_target_new()}
                description={m.tournaments_playriftbound_target_new_description()}
              />
            </RadioGroup>
          )}
          {target === NEW_TOURNAMENT ? (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="playriftbound-new-name">{m.common_name()}</Label>
                <NameField id="playriftbound-new-name" value={name} onChange={setName} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{m.tournaments_lib_viewer_role_host()}</Label>
                <HostField value={hostValue} onChange={setHostValue} />
              </div>
            </div>
          ) : null}
        </SettingsSection>

        <SettingsSection title={m.tournaments_playriftbound_players_title()}>
          <RowList>
            {payload.registrants.map((registrant) => (
              <RowListItem key={registrant.playerId} className="justify-between gap-3">
                <span className="min-w-0 truncate">
                  {playriftboundRiotId(registrant) ?? registrant.displayName}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">
                  {registrantStatus(registrant)}
                </span>
              </RowListItem>
            ))}
          </RowList>
        </SettingsSection>
      </SettingsGroup>

      <SaveError error={createTournament.error ?? syncPlayriftbound.error} />
      {result === undefined ? null : <SyncResult result={result} />}
      <div className="flex items-center gap-2">
        <Button onClick={() => void handleSync()} disabled={!canSync} pending={pending}>
          {result === undefined
            ? m.tournaments_playriftbound_sync()
            : m.tournaments_playriftbound_sync_again()}
        </Button>
      </div>
    </>
  );
}

export function PlayriftboundSyncPage() {
  const payload = usePlayriftboundHandoff();

  return (
    <TopBarBreadcrumbBar
      segments={[{ label: m.nav_tournaments(), link: <Link to="/tournaments" /> }]}
      title={m.tournaments_playriftbound_title()}
    >
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        {payload === undefined ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{m.tournaments_playriftbound_waiting_title()}</EmptyTitle>
              <EmptyDescription>
                {m.tournaments_playriftbound_waiting_description()}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <SyncForm key={payload.readAt} payload={payload} />
        )}
      </div>
    </TopBarBreadcrumbBar>
  );
}
