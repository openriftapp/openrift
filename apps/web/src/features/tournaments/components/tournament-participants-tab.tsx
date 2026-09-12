import type {
  TournamentDetailResponse,
  TournamentParticipantStatus,
} from "@openrift/shared/types/api/tournament";
import { CheckIcon, GlobeIcon, UserPlusIcon, UserXIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StatStripItem } from "@/components/ui/stat-strip";
import { StatStrip } from "@/components/ui/stat-strip";
import { SearchInput } from "@/features/cards/components/search-input";
import type { LegendTarget } from "@/features/tournaments/components/legend-picker-dialog";
import { LegendPickerDialog } from "@/features/tournaments/components/legend-picker-dialog";
import { MissingRegionsBand } from "@/features/tournaments/components/missing-regions-band";
import type {
  ParticipantAction,
  ParticipantTarget,
} from "@/features/tournaments/components/participant-row";
import {
  ParticipantRow,
  participantMissesRegion,
} from "@/features/tournaments/components/participant-row";
import {
  TeamsSection,
  teammateNamesById,
  unteamedActivePlayers,
} from "@/features/tournaments/components/teams-section";
import { useTournamentDeckCheckEntries } from "@/features/tournaments/hooks/use-tournament-deck-check";
import {
  useAddParticipant,
  useParticipantAction,
  useUpdateParticipant,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentParticipants } from "@/features/tournaments/hooks/use-tournaments";
import { canCheckDecks, canManageTournament } from "@/features/tournaments/lib/tournament-display";
import { useCustomTagList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

function rosterGroups(): {
  key: string;
  heading: string;
  statuses: TournamentParticipantStatus[];
  icon?: typeof UserPlusIcon;
  dimmed?: boolean;
}[] {
  return [
    {
      key: "requested",
      heading: m.tournaments_overview_join_requests(),
      statuses: ["requested"],
      icon: UserPlusIcon,
    },
    { key: "invited", heading: m.tournaments_roster_group_invited(), statuses: ["invited"] },
    { key: "active", heading: m.tournaments_roster_group_active(), statuses: ["active"] },
    {
      key: "inactive",
      heading: m.tournaments_roster_group_dropped(),
      statuses: ["dropped", "no_show"],
      dimmed: true,
    },
  ];
}

export function TournamentParticipantsTab({
  id,
  detail,
}: {
  id: string;
  detail: TournamentDetailResponse;
}) {
  const manage = canManageTournament(detail.myRoles);
  const canAssignRegion = detail.regionsEnabled && canCheckDecks(detail.myRoles);
  const groupCut = detail.format === "group_cut";
  const canAssignLegend = groupCut && !detail.hasRounds && canCheckDecks(detail.myRoles);
  const { data } = useTournamentParticipants(id);
  const participants = data.items;
  const updateParticipant = useUpdateParticipant();
  const participantAction = useParticipantAction();

  // The deck-check endpoint 404s when deck submission is off; only fetch when
  // the viewer can manage and the tournament collects decks.
  const { data: deckCheck } = useTournamentDeckCheckEntries(
    id,
    manage && detail.deckSubmission !== "none",
  );
  const entryByParticipant = new Map(
    (deckCheck?.entries ?? [])
      .filter((entry) => entry.participantId !== null)
      .map((entry) => [entry.participantId as string, entry]),
  );

  const [search, setSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<ParticipantTarget | null>(null);
  const [regionTarget, setRegionTarget] = useState<(ParticipantTarget & { region: string }) | null>(
    null,
  );
  const [fixedTableTarget, setFixedTableTarget] = useState<
    (ParticipantTarget & { fixedTable: string }) | null
  >(null);
  const [removeTarget, setRemoveTarget] = useState<ParticipantTarget | null>(null);
  const [legendTarget, setLegendTarget] = useState<LegendTarget | null>(null);

  const missingRegionPlayers = participants.filter((participant) =>
    participantMissesRegion(participant, detail.regionsEnabled),
  );
  const activeCount = participants.filter((participant) => participant.status === "active").length;
  const droppedCount = participants.filter(
    (participant) => participant.status === "dropped" || participant.status === "no_show",
  ).length;
  const withRegionCount = activeCount - missingRegionPlayers.length;
  const teamMode = detail.playMode === "2v2";
  const unteamedCount = teamMode ? unteamedActivePlayers(participants).length : 0;
  const teammateNames = teamMode ? teammateNamesById(participants) : new Map<string, string>();

  const stats: StatStripItem[] = [
    {
      key: "active",
      value: activeCount,
      label: m.tournaments_roster_stat_active(),
      icon: CheckIcon,
      iconTone: "success",
    },
    {
      key: "dropped",
      value: droppedCount,
      label: m.tournaments_roster_stat_dropped(),
      icon: UserXIcon,
    },
    ...(teamMode
      ? [
          {
            key: "teamed",
            value: `${activeCount - unteamedCount}/${activeCount}`,
            label: m.tournaments_roster_stat_on_a_team(),
            icon: CheckIcon,
            tone: (unteamedCount === 0 && activeCount > 0
              ? "good"
              : "default") as StatStripItem["tone"],
          },
        ]
      : []),
    ...(detail.regionsEnabled
      ? [
          {
            key: "regions",
            value: `${withRegionCount}/${activeCount}`,
            label: m.tournaments_roster_stat_with_region(),
            icon: GlobeIcon,
            iconTone: "info" as const,
            tone: (missingRegionPlayers.length === 0 && activeCount > 0
              ? "good"
              : "default") as StatStripItem["tone"],
          },
        ]
      : []),
  ];

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? participants.filter((participant) =>
        [participant.displayName, participant.userName].some((field) =>
          field?.toLowerCase().includes(needle),
        ),
      )
    : participants;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      // Reported by the global mutation onError toast.
    }
  }

  function fireAction(participantId: string, action: ParticipantAction) {
    void run(() => participantAction.mutateAsync({ id, participantId, action }));
  }

  const groups = rosterGroups()
    .map((group) => ({
      ...group,
      players: visible
        .filter((participant) => group.statuses.includes(participant.status))
        .toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
    .filter((group) => group.players.length > 0);

  async function handleRename() {
    const displayName = renameTarget?.name.trim();
    if (!renameTarget || !displayName) {
      return;
    }
    await run(() =>
      updateParticipant.mutateAsync({
        id,
        participantId: renameTarget.participantId,
        displayName,
      }),
    );
    setRenameTarget(null);
  }

  async function handleSetRegion() {
    if (!regionTarget) {
      return;
    }
    const region = regionTarget.region === "none" ? null : regionTarget.region;
    await run(() =>
      updateParticipant.mutateAsync({ id, participantId: regionTarget.participantId, region }),
    );
    setRegionTarget(null);
  }

  async function handleSetLegend(participantId: string, legendCardId: string | null) {
    await run(() => updateParticipant.mutateAsync({ id, participantId, legendCardId }));
    setLegendTarget(null);
  }

  async function handleSetFixedTable() {
    if (!fixedTableTarget) {
      return;
    }
    const parsed = parseFixedTable(fixedTableTarget.fixedTable);
    if (parsed === undefined) {
      return;
    }
    await run(() =>
      updateParticipant.mutateAsync({
        id,
        participantId: fixedTableTarget.participantId,
        fixedTable: parsed,
      }),
    );
    setFixedTableTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {canAssignRegion && missingRegionPlayers.length > 0 ? (
        <MissingRegionsBand players={missingRegionPlayers} onSetRegion={setRegionTarget} />
      ) : null}

      {teamMode ? <TeamsSection id={id} participants={participants} manage={manage} /> : null}

      {participants.length > 0 ? (
        <>
          <StatStrip items={stats} />
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder={m.tournaments_roster_search_players()}
            ariaLabel={m.tournaments_roster_search_players()}
            className="w-full max-w-xs"
          />
        </>
      ) : null}

      {participants.length === 0 ? (
        <p className="text-muted-foreground">
          {manage ? m.tournaments_roster_empty_manage() : m.tournaments_roster_empty()}
        </p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">{m.tournaments_roster_no_match()}</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <SectionHeading count={group.players.length} icon={group.icon} tone="gold">
              {group.heading}
            </SectionHeading>
            <ul className="flex flex-col gap-2">
              {group.players.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  tournamentId={id}
                  regionsEnabled={detail.regionsEnabled}
                  manage={manage}
                  canAssignRegion={canAssignRegion}
                  canAssignLegend={canAssignLegend}
                  legendTiebreak={groupCut && detail.legendTiebreak}
                  dimmed={group.dimmed}
                  teammateName={teammateNames.get(participant.id)}
                  deckEntryId={entryByParticipant.get(participant.id)?.id}
                  actionPending={participantAction.isPending}
                  onAction={fireAction}
                  onRename={setRenameTarget}
                  onSetLegend={setLegendTarget}
                  onSetRegion={setRegionTarget}
                  onSetFixedTable={setFixedTableTarget}
                  onRemove={setRemoveTarget}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleRename()}>
            <DialogHeader>
              <DialogTitle>{m.tournaments_roster_rename_title()}</DialogTitle>
            </DialogHeader>
            <Input
              value={renameTarget?.name ?? ""}
              maxLength={120}
              onChange={(event) =>
                setRenameTarget((prev) => (prev ? { ...prev, name: event.target.value } : prev))
              }
              aria-label={m.tournaments_roster_rename_aria()}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>
                {m.common_cancel()}
              </Button>
              <Button
                type="submit"
                disabled={!renameTarget?.name.trim() || updateParticipant.isPending}
              >
                {m.common_save()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={regionTarget !== null} onOpenChange={(open) => !open && setRegionTarget(null)}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleSetRegion()}>
            <DialogHeader>
              <DialogTitle>
                {m.tournaments_roster_region_title({ name: regionTarget?.name ?? "" })}
              </DialogTitle>
              <DialogDescription>{m.tournaments_roster_region_description()}</DialogDescription>
            </DialogHeader>
            <RegionSelect
              value={regionTarget?.region ?? "none"}
              onChange={(value) =>
                setRegionTarget((prev) => (prev ? { ...prev, region: value } : prev))
              }
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRegionTarget(null)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={updateParticipant.isPending}>
                {m.common_save()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fixedTableTarget !== null}
        onOpenChange={(open) => !open && setFixedTableTarget(null)}
      >
        <DialogContent>
          <DialogForm onSubmit={() => void handleSetFixedTable()}>
            <DialogHeader>
              <DialogTitle>
                {m.tournaments_roster_fixed_table_title({ name: fixedTableTarget?.name ?? "" })}
              </DialogTitle>
              <DialogDescription>
                {m.tournaments_roster_fixed_table_description()}
              </DialogDescription>
            </DialogHeader>
            <Input
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              value={fixedTableTarget?.fixedTable ?? ""}
              onChange={(event) =>
                setFixedTableTarget((prev) =>
                  prev ? { ...prev, fixedTable: event.target.value } : prev,
                )
              }
              placeholder={m.tournaments_roster_fixed_table_placeholder()}
              aria-label={m.tournaments_roster_fixed_table_aria()}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFixedTableTarget(null)}>
                {m.common_cancel()}
              </Button>
              <Button
                type="submit"
                disabled={
                  updateParticipant.isPending ||
                  parseFixedTable(fixedTableTarget?.fixedTable ?? "") === undefined
                }
              >
                {m.common_save()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <LegendPickerDialog
        target={legendTarget}
        pending={updateParticipant.isPending}
        onOpenChange={(open) => !open && setLegendTarget(null)}
        onPick={(participantId, legendCardId) => void handleSetLegend(participantId, legendCardId)}
      />

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogForm
            onSubmit={() => {
              if (removeTarget) {
                fireAction(removeTarget.participantId, "remove");
                setRemoveTarget(null);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {m.tournaments_roster_remove_title({ name: removeTarget?.name ?? "" })}
              </DialogTitle>
              <DialogDescription>{m.tournaments_roster_remove_description()}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" variant="destructive" disabled={participantAction.isPending}>
                {m.tournaments_roster_remove()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Empty clears the fixed table (null); undefined means the draft is invalid.
function parseFixedTable(draft: string): number | null | undefined {
  const trimmed = draft.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
    return undefined;
  }
  return parsed;
}

function RegionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { byCategory } = useCustomTagList();
  const items = [
    { value: "none", label: m.tournaments_roster_region_none() },
    ...(byCategory.get("region") ?? []).map((tag) => ({ value: tag.slug, label: tag.label })),
  ];
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger aria-label={m.tournaments_roster_region_label()}>
        <SelectValue placeholder={m.tournaments_roster_region_label()} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AddParticipantButton({ id }: { id: string }) {
  const addParticipant = useAddParticipant();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit() {
    const displayName = name.trim();
    if (!displayName) {
      return;
    }
    try {
      await addParticipant.mutateAsync({ id, displayName });
      setName("");
      setOpen(false);
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  return (
    <>
      <PageTopBarPrimaryButton onClick={() => setOpen(true)}>
        <UserPlusIcon className="size-4" />
        {m.tournaments_roster_add_player()}
      </PageTopBarPrimaryButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.tournaments_roster_add_player()}</DialogTitle>
            <DialogDescription>{m.tournaments_roster_add_player_description()}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder={m.tournaments_roster_player_name()}
              aria-label={m.tournaments_roster_player_name()}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={!name.trim() || addParticipant.isPending}>
                {m.tournaments_roster_add()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
