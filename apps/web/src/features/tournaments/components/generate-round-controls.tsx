import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { PodPlayerResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UserMinusIcon,
  UserXIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ActionBand } from "@/components/ui/action-band";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { CommandEmpty, CommandGroup } from "@/components/ui/command";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TextLink } from "@/components/ui/text-link";
import { PlayerChip } from "@/features/tournaments/components/player-chip";
import { useParticipantAction } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useGenerateTournamentRound } from "@/features/tournaments/hooks/use-tournament-run";
import { teamDisplayName } from "@/features/tournaments/lib/team-display";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface ByeUnit {
  key: string;
  label: string;
  memberIds: [string, ...string[]];
}

function PlayerAvatarChip({
  name,
  standing,
  className,
  children,
}: {
  name: string;
  standing: PodStandingRow | undefined;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <PlayerChip
      name={name}
      image={standing?.image}
      gravatarHash={standing?.gravatarHash}
      className={className}
    >
      {children}
    </PlayerChip>
  );
}

function ParticipantsFixAlert({
  id,
  message,
  playerIds,
  nameById,
}: {
  id: string;
  message: typeof m.tournaments_pairings_no_region;
  playerIds: readonly string[];
  nameById: ReadonlyMap<string, string>;
}) {
  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertTitle>
        <ParaglideMessage
          message={message}
          inputs={{
            count: playerIds.length,
            names: playerIds
              .map((playerId) => nameById.get(playerId) ?? m.tournaments_pairings_fallback_player())
              .join(", "),
          }}
          markup={{
            link: ({ children }) => (
              <TextLink render={<Link to="/tournaments/$id/participants" params={{ id }} />}>
                {children}
              </TextLink>
            ),
          }}
        />
      </AlertTitle>
    </Alert>
  );
}

export function GenerateRoundControls({
  id,
  players,
  standings,
  isFirstRound,
  nextRoundNumber,
  reachedSuggestion,
  suggested,
  swissAutoBye = false,
  playMode = "1v1",
  missingRegionIds = [],
}: {
  id: string;
  players: PodPlayerResponse[];
  standings: PodStandingRow[];
  isFirstRound: boolean;
  nextRoundNumber: number;
  reachedSuggestion: boolean;
  suggested: number;
  swissAutoBye?: boolean;
  playMode?: TournamentPlayMode;
  missingRegionIds?: string[];
}) {
  const generateRound = useGenerateTournamentRound();
  const participantAction = useParticipantAction();
  const [byeIds, setByeIds] = useState<string[]>([]);
  const [byeHighlight, setByeHighlight] = useState("");
  const [dropHighlight, setDropHighlight] = useState("");

  const teamMode = playMode === "2v2";
  const activePlayers = players.filter((player) => player.status === "active");
  const droppedPlayers = players.filter((player) => player.status === "dropped");
  const standingById = new Map(standings.map((row) => [row.playerId, row]));
  const byeCountById = new Map(standings.map((row) => [row.playerId, row.byeCount]));
  const nameById = new Map(players.map((player) => [player.id, player.displayName]));

  const soloUnit = (player: PodPlayerResponse): ByeUnit => ({
    key: player.id,
    label: player.displayName,
    memberIds: [player.id],
  });
  const byeUnits: ByeUnit[] = teamMode
    ? [
        ...activePlayers
          .filter((player) => player.teamId === null)
          .map((player) => soloUnit(player)),
        ...[
          ...Map.groupBy(
            activePlayers.filter((player) => player.teamId !== null),
            (player) => player.teamId ?? "",
          ),
        ].flatMap(([teamId, members]): ByeUnit[] => {
          const [lead, ...rest] = members;
          return lead === undefined
            ? []
            : [
                {
                  key: teamId,
                  label: teamDisplayName(members.map((member) => member.displayName)),
                  memberIds: [lead.id, ...rest.map((member) => member.id)],
                },
              ];
        }),
      ]
    : activePlayers.map((player) => soloUnit(player));
  const unitChecked = (unit: { memberIds: string[] }) =>
    unit.memberIds.every((memberId) => byeIds.includes(memberId));
  const selectedUnits = byeUnits.filter((unit) => unitChecked(unit));
  const repeatByeUnits = selectedUnits.filter(
    (unit) => (byeCountById.get(unit.memberIds[0]) ?? 0) >= 1,
  );

  // The server rejects a pairing that seats a region-less player, so mirror
  // that here: byed players are exempt, everyone else needs a region first.
  const seatedWithoutRegion = missingRegionIds.filter((playerId) => !byeIds.includes(playerId));
  const seatedWithoutTeam = teamMode
    ? activePlayers
        .filter((player) => player.teamId === null && !byeIds.includes(player.id))
        .map((player) => player.id)
    : [];
  const seatedCount = activePlayers.length - byeIds.length;
  const blocked = seatedWithoutRegion.length > 0 || seatedWithoutTeam.length > 0;

  function toggleByeUnit(unit: { memberIds: string[] }) {
    setByeIds((current) =>
      unit.memberIds.every((memberId) => current.includes(memberId))
        ? current.filter((byeId) => !unit.memberIds.includes(byeId))
        : [...current.filter((byeId) => !unit.memberIds.includes(byeId)), ...unit.memberIds],
    );
  }

  async function setDropped(player: PodPlayerResponse, dropped: boolean) {
    const action = dropped ? "drop" : "reactivate";
    // A dropped player can't be seated, so they can't hold a bye either. In
    // 2v2 the server drops the whole team, so the teammate's bye goes too.
    const goneIds =
      teamMode && player.teamId !== null
        ? players.filter((row) => row.teamId === player.teamId).map((row) => row.id)
        : [player.id];
    const ok = await runReportedMutation(() =>
      participantAction.mutateAsync({ id, participantId: player.id, action }),
    );
    if (ok && dropped) {
      setByeIds((current) => current.filter((byeId) => !goneIds.includes(byeId)));
    }
  }

  async function generate() {
    if (await runReportedMutation(() => generateRound.mutateAsync({ id, byes: byeIds }))) {
      setByeIds([]);
    }
  }

  return (
    <ActionBand
      icon={UserMinusIcon}
      accent
      label={m.tournaments_group_round_label({ number: nextRoundNumber })}
      value={teamMode ? Math.floor(seatedCount / 2) : seatedCount}
      sub={
        suggested > 0
          ? m.tournaments_pairings_pair_sub_with_total({
              unit: teamMode
                ? m.tournaments_pairings_unit_teams()
                : m.tournaments_pairings_unit_players(),
              round: nextRoundNumber,
              suggested,
            })
          : m.tournaments_pairings_pair_sub({
              unit: teamMode
                ? m.tournaments_pairings_unit_teams()
                : m.tournaments_pairings_unit_players(),
            })
      }
      action={
        <Button
          disabled={blocked}
          pending={generateRound.isPending}
          onClick={() => void generate()}
        >
          {isFirstRound
            ? m.tournaments_pairings_generate_round_one()
            : m.tournaments_pairings_generate_next_round()}
        </Button>
      }
    >
      {/* Kept open while every player is dropped: that is exactly when the
          organizer needs the drop picker to bring someone back. */}
      {activePlayers.length > 0 || droppedPlayers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activePlayers.length > 0 ? (
            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                <UserMinusIcon />
                {selectedUnits.length === 0
                  ? teamMode
                    ? m.tournaments_pairings_sit_teams_out()
                    : m.tournaments_pairings_sit_players_out()
                  : m.tournaments_pairings_sitting_out_count({ count: selectedUnits.length })}
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <PickerList
                  searchPlaceholder={
                    teamMode
                      ? m.tournaments_pairings_search_teams()
                      : m.tournaments_pairings_search_players()
                  }
                  highlightedId={byeHighlight}
                  onHighlightChange={setByeHighlight}
                >
                  <CommandEmpty>
                    {teamMode
                      ? m.tournaments_pairings_no_teams_found()
                      : m.tournaments_pairings_no_players_found()}
                  </CommandEmpty>
                  {byeUnits.map((unit) => {
                    const priorByes = byeCountById.get(unit.memberIds[0]) ?? 0;
                    return (
                      <PickerRow
                        key={unit.key}
                        value={unit.key}
                        keywords={[unit.label]}
                        onSelect={() => toggleByeUnit(unit)}
                        className="px-2 py-1.5"
                      >
                        <PlayerAvatarChip
                          name={unit.label}
                          standing={
                            unit.memberIds.length === 1
                              ? standingById.get(unit.memberIds[0])
                              : undefined
                          }
                        >
                          {priorByes > 0 ? (
                            <Badge variant="warning">
                              {m.tournaments_pairings_byes_count({ count: priorByes })}
                            </Badge>
                          ) : null}
                        </PlayerAvatarChip>
                        <CheckIcon
                          className={cn(
                            "ml-auto size-4 shrink-0",
                            !unitChecked(unit) && "opacity-0",
                          )}
                        />
                      </PickerRow>
                    );
                  })}
                </PickerList>
              </PopoverContent>
            </Popover>
          ) : null}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <UserXIcon />
              {m.tournaments_pairings_drop_players()}
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <PickerList
                searchPlaceholder={m.tournaments_pairings_search_players()}
                highlightedId={dropHighlight}
                onHighlightChange={setDropHighlight}
              >
                <CommandEmpty>{m.tournaments_pairings_no_players_found()}</CommandEmpty>
                <CommandGroup heading={m.tournaments_pairings_group_active()} className="p-0">
                  {activePlayers.map((player) => (
                    <PickerRow
                      key={player.id}
                      value={player.id}
                      keywords={[player.displayName]}
                      disabled={participantAction.isPending}
                      onSelect={() => void setDropped(player, true)}
                      className="px-2 py-1.5"
                    >
                      <PlayerAvatarChip
                        name={player.displayName}
                        standing={standingById.get(player.id)}
                        className="flex-1"
                      />
                      <UserXIcon className="text-muted-foreground size-4 shrink-0" />
                    </PickerRow>
                  ))}
                </CommandGroup>
                {droppedPlayers.length > 0 ? (
                  <CommandGroup heading={m.tournaments_pairings_group_dropped()} className="p-0">
                    {droppedPlayers.map((player) => (
                      <PickerRow
                        key={player.id}
                        value={player.id}
                        keywords={[player.displayName]}
                        disabled={participantAction.isPending}
                        onSelect={() => void setDropped(player, false)}
                        className="px-2 py-1.5"
                      >
                        <PlayerAvatarChip
                          name={player.displayName}
                          standing={standingById.get(player.id)}
                          className="flex-1 opacity-60"
                        />
                        <RotateCcwIcon className="text-muted-foreground size-4 shrink-0" />
                      </PickerRow>
                    ))}
                  </CommandGroup>
                ) : null}
              </PickerList>
            </PopoverContent>
          </Popover>
          {selectedUnits.map((unit) => (
            <Badge key={unit.key} variant="secondary">
              {unit.label}
              <ChipRemoveButton
                aria-label={m.tournaments_pairings_dont_sit_out({ name: unit.label })}
                onClick={() => toggleByeUnit(unit)}
              />
            </Badge>
          ))}
        </div>
      ) : null}
      {repeatByeUnits.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>
            {m.tournaments_pairings_repeat_bye({
              count: repeatByeUnits.length,
              names: repeatByeUnits.map((unit) => unit.label).join(", "),
            })}
          </AlertTitle>
        </Alert>
      ) : null}
      {seatedWithoutRegion.length > 0 ? (
        <ParticipantsFixAlert
          id={id}
          message={m.tournaments_pairings_no_region}
          playerIds={seatedWithoutRegion}
          nameById={nameById}
        />
      ) : null}
      {seatedWithoutTeam.length > 0 ? (
        <ParticipantsFixAlert
          id={id}
          message={m.tournaments_pairings_no_team}
          playerIds={seatedWithoutTeam}
          nameById={nameById}
        />
      ) : null}
      {swissAutoBye ? (
        <p className="text-muted-foreground text-sm">
          {teamMode
            ? m.tournaments_pairings_auto_bye_teams()
            : m.tournaments_pairings_auto_bye_players()}
        </p>
      ) : null}
      {reachedSuggestion ? (
        <p className="text-muted-foreground text-sm">
          {m.tournaments_pairings_suggested_reached({ count: suggested })}
        </p>
      ) : null}
    </ActionBand>
  );
}
