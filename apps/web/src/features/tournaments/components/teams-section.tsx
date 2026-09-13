import type { TournamentParticipantResponse } from "@openrift/shared/types/api/tournament";
import { TriangleAlertIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardRow } from "@/components/ui/card-list";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import {
  useCreateTeam,
  useDissolveTeam,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { teamDisplayName } from "@/features/tournaments/lib/team-display";
import { m } from "@/paraglide/messages.js";

/**
 * The 2v2 team roster. Dissolving is only possible until the team has played
 * a round; the server enforces it and its errors surface as toasts here.
 */
export function TeamsSection({
  id,
  participants,
  manage,
}: {
  id: string;
  participants: TournamentParticipantResponse[];
  manage: boolean;
}) {
  const createTeam = useCreateTeam();
  const dissolveTeam = useDissolveTeam();
  const [firstId, setFirstId] = useState<string>("");
  const [secondId, setSecondId] = useState<string>("");

  const roster = participants.filter(
    (participant) => participant.status === "active" || participant.status === "dropped",
  );
  const byTeam = new Map<string, TournamentParticipantResponse[]>();
  for (const participant of roster) {
    if (participant.teamId === null) {
      continue;
    }
    const members = byTeam.get(participant.teamId) ?? [];
    members.push(participant);
    byTeam.set(participant.teamId, members);
  }
  const teams = [...byTeam.entries()].map(([teamId, members]) => ({
    teamId,
    members,
    dropped: members.every((member) => member.status === "dropped"),
  }));
  const unteamed = participants.filter(
    (participant) => participant.status === "active" && participant.teamId === null,
  );
  const [soleUnteamed] = unteamed;
  const pickable = (excludeId: string) => unteamed.filter((player) => player.id !== excludeId);

  async function handleCreate() {
    if (!firstId || !secondId || firstId === secondId) {
      return;
    }
    try {
      await createTeam.mutateAsync({ id, participantIds: [firstId, secondId] });
      setFirstId("");
      setSecondId("");
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  async function handleDissolve(teamId: string, name: string) {
    try {
      await dissolveTeam.mutateAsync({ id, teamId });
      toast.success(m.tournaments_teams_dissolved_toast({ name }));
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={UsersIcon} count={teams.length}>
        {m.tournaments_teams_heading()}
      </SectionHeading>
      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_teams_empty()}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => {
            const name = teamDisplayName(team.members.map((member) => member.displayName));
            return (
              <CardRow key={team.teamId} className={team.dropped ? "opacity-50" : undefined}>
                <span className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={name} size="sm" />
                  <span className="truncate font-medium">{name}</span>
                  {team.dropped ? (
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {m.tournaments_standings_dropped()}
                    </span>
                  ) : null}
                </span>
                {manage ? (
                  <ChipRemoveButton
                    aria-label={m.tournaments_teams_dissolve_aria({ name })}
                    onClick={() => void handleDissolve(team.teamId, name)}
                  />
                ) : null}
              </CardRow>
            );
          })}
        </ul>
      )}
      {unteamed.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>
            {m.tournaments_teams_unteamed({
              count: unteamed.length,
              name: soleUnteamed?.displayName ?? "",
              names: unteamed.map((player) => player.displayName).join(", "),
            })}{" "}
            {m.tournaments_teams_unteamed_hint()}
          </AlertTitle>
        </Alert>
      ) : null}
      {manage && unteamed.length >= 2 ? (
        <div className="flex flex-wrap items-end gap-2">
          <TeamMemberPicker
            label={m.tournaments_teams_first_player()}
            value={firstId}
            players={pickable(secondId)}
            onChange={setFirstId}
          />
          <TeamMemberPicker
            label={m.tournaments_teams_second_player()}
            value={secondId}
            players={pickable(firstId)}
            onChange={setSecondId}
          />
          <Button
            size="sm"
            disabled={!firstId || !secondId || firstId === secondId || createTeam.isPending}
            onClick={() => void handleCreate()}
          >
            {m.tournaments_teams_pair()}
          </Button>
        </div>
      ) : null}
      {manage && unteamed.length === 1 ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_teams_waiting()}</p>
      ) : null}
    </section>
  );
}

function TeamMemberPicker({
  label,
  value,
  players,
  onChange,
}: {
  label: string;
  value: string;
  players: TournamentParticipantResponse[];
  onChange: (value: string) => void;
}) {
  const items = players.map((player) => ({ value: player.id, label: player.displayName }));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="w-48" aria-label={label}>
          <SelectValue placeholder={m.tournaments_teams_pick_player()} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function unteamedActivePlayers(
  participants: readonly TournamentParticipantResponse[],
): TournamentParticipantResponse[] {
  return participants.filter(
    (participant) => participant.status === "active" && participant.teamId === null,
  );
}

/** Participants without a team, or whose partner left the roster, are absent from the map. */
export function teammateNamesById(
  participants: readonly TournamentParticipantResponse[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const participant of participants) {
    if (participant.teamId === null) {
      continue;
    }
    const teammate = participants.find(
      (other) => other.teamId === participant.teamId && other.id !== participant.id,
    );
    if (teammate) {
      names.set(participant.id, teammate.displayName);
    }
  }
  return names;
}
