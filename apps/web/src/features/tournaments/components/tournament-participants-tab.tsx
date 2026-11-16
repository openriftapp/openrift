import { matchesTextQuery } from "@openrift/shared/search-fold";
import type {
  TournamentDetailResponse,
  TournamentParticipantStatus,
} from "@openrift/shared/types/api/tournament";
import { CheckIcon, GlobeIcon, UserPlusIcon, UsersIcon, UserXIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { SimpleSelect } from "@/components/ui/simple-select";
import type { StatStripItem } from "@/components/ui/stat-strip";
import { StatStrip } from "@/components/ui/stat-strip";
import type { LegendTarget } from "@/features/tournaments/components/legend-search-dialog";
import { LegendSearchDialog } from "@/features/tournaments/components/legend-search-dialog";
import { MissingRegionsBand } from "@/features/tournaments/components/missing-regions-band";
import type { ParticipantTarget } from "@/features/tournaments/components/participant-row";
import {
  ParticipantRow,
  participantMissesRegion,
} from "@/features/tournaments/components/participant-row";
import { SaveError } from "@/features/tournaments/components/save-error";
import { TeamsSection } from "@/features/tournaments/components/teams-section";
import { useTournamentDeckCheckEntries } from "@/features/tournaments/hooks/use-tournament-deck-check";
import {
  useAddParticipant,
  useParticipantAction,
  useUpdateParticipant,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentParticipants } from "@/features/tournaments/hooks/use-tournaments";
import { participantName } from "@/features/tournaments/lib/participant-name";
import { teammateNamesById, unteamedActivePlayers } from "@/features/tournaments/lib/team-display";
import type { ParticipantAction } from "@/features/tournaments/lib/tournament-display";
import {
  canManageTournament,
  participantsOpen,
  pendingParticipantAction,
  isTournamentStaff,
} from "@/features/tournaments/lib/tournament-display";
import { useCustomTagList } from "@/hooks/use-enums";
import { parseIntegerInput } from "@/lib/integer-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
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
  const canAssignRegion = detail.regionsEnabled && isTournamentStaff(detail.myRoles);
  const groupCut = detail.format === "group_cut";
  const canAssignLegend = groupCut && !detail.hasRounds && isTournamentStaff(detail.myRoles);
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

  function openRename(target: ParticipantTarget | null) {
    updateParticipant.reset();
    setRenameTarget(target);
  }

  function openRegion(target: (ParticipantTarget & { region: string }) | null) {
    updateParticipant.reset();
    setRegionTarget(target);
  }

  function openFixedTable(target: (ParticipantTarget & { fixedTable: string }) | null) {
    updateParticipant.reset();
    setFixedTableTarget(target);
  }

  function openLegend(target: LegendTarget | null) {
    updateParticipant.reset();
    setLegendTarget(target);
  }

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
              ? "success"
              : "neutral") as StatStripItem["tone"],
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
              ? "success"
              : "neutral") as StatStripItem["tone"],
          },
        ]
      : []),
  ];

  const visible = participants.filter((participant) =>
    matchesTextQuery(search, [participantName(participant.displayName), participant.userName]),
  );

  function fireAction(participantId: string, action: ParticipantAction) {
    void runReportedMutation(() => participantAction.mutateAsync({ id, participantId, action }));
  }

  async function handleRemove() {
    if (!removeTarget) {
      return;
    }
    const participantId = removeTarget.participantId;
    if (
      await runReportedMutation(() =>
        participantAction.mutateAsync({ id, participantId, action: "remove" }),
      )
    ) {
      setRemoveTarget(null);
    }
  }

  const groups = rosterGroups()
    .map((group) => ({
      ...group,
      players: visible
        .filter((participant) => group.statuses.includes(participant.status))
        .toSorted((a, b) =>
          participantName(a.displayName).localeCompare(participantName(b.displayName)),
        ),
    }))
    .filter((group) => group.players.length > 0);

  async function handleRename() {
    const displayName = renameTarget?.name.trim();
    if (!renameTarget || !displayName) {
      return;
    }
    if (
      await runReportedMutation(() =>
        updateParticipant.mutateAsync({
          id,
          participantId: renameTarget.participantId,
          displayName,
        }),
      )
    ) {
      setRenameTarget(null);
    }
  }

  async function handleSetRegion() {
    if (!regionTarget) {
      return;
    }
    const region = regionTarget.region === "none" ? null : regionTarget.region;
    if (
      await runReportedMutation(() =>
        updateParticipant.mutateAsync({ id, participantId: regionTarget.participantId, region }),
      )
    ) {
      setRegionTarget(null);
    }
  }

  async function handleSetLegend(participantId: string, legendCardId: string | null) {
    if (
      await runReportedMutation(() =>
        updateParticipant.mutateAsync({ id, participantId, legendCardId }),
      )
    ) {
      setLegendTarget(null);
    }
  }

  async function handleSetFixedTable() {
    if (!fixedTableTarget) {
      return;
    }
    const parsed = parseIntegerInput(fixedTableTarget.fixedTable, 1, 999);
    if (parsed === undefined) {
      return;
    }
    if (
      await runReportedMutation(() =>
        updateParticipant.mutateAsync({
          id,
          participantId: fixedTableTarget.participantId,
          fixedTable: parsed,
        }),
      )
    ) {
      setFixedTableTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canAssignRegion && missingRegionPlayers.length > 0 ? (
        <MissingRegionsBand players={missingRegionPlayers} onSetRegion={openRegion} />
      ) : null}

      {teamMode ? <TeamsSection id={id} participants={participants} manage={manage} /> : null}

      {participants.length > 0 ? (
        <>
          <StatStrip items={stats} />
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder={m.tournaments_roster_search_players()}
            aria-label={m.tournaments_roster_search_players()}
            className="w-full max-w-xs"
          />
        </>
      ) : null}

      {participants.length === 0 ? (
        <EmptyState
          className="py-12"
          icon={UsersIcon}
          title={m.tournaments_roster_empty_title()}
          description={manage ? m.tournaments_roster_empty_manage_description() : undefined}
        />
      ) : groups.length === 0 ? (
        <Empty>
          <EmptyDescription>{m.tournaments_roster_no_match()}</EmptyDescription>
        </Empty>
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
                  deckWithdrawn={entryByParticipant.get(participant.id)?.state === "withdrawn"}
                  pendingAction={pendingParticipantAction(participantAction, participant.id)}
                  approveOpen={participantsOpen(detail.status)}
                  onAction={fireAction}
                  onRename={openRename}
                  onSetLegend={openLegend}
                  onSetRegion={openRegion}
                  onSetFixedTable={openFixedTable}
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
            <SaveError error={updateParticipant.error} />
            <DialogFooter>
              <DialogCancel />
              <Button
                type="submit"
                disabled={!renameTarget?.name.trim()}
                pending={updateParticipant.isPending}
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
            <SaveError error={updateParticipant.error} />
            <DialogFooter>
              <DialogCancel />
              <Button type="submit" pending={updateParticipant.isPending}>
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
            <SaveError error={updateParticipant.error} />
            <DialogFooter>
              <DialogCancel />
              <Button
                type="submit"
                disabled={
                  parseIntegerInput(fixedTableTarget?.fixedTable ?? "", 1, 999) === undefined
                }
                pending={updateParticipant.isPending}
              >
                {m.common_save()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <LegendSearchDialog
        target={legendTarget}
        pending={updateParticipant.isPending}
        error={updateParticipant.error}
        onOpenChange={(open) => !open && setLegendTarget(null)}
        onPick={(participantId, legendCardId) => void handleSetLegend(participantId, legendCardId)}
      />

      <ConfirmActionDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={m.tournaments_roster_remove_title({ name: removeTarget?.name ?? "" })}
        description={m.tournaments_roster_remove_description()}
        confirmLabel={m.tournaments_roster_remove()}
        isPending={participantAction.isPending}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}

function RegionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { byCategory } = useCustomTagList();
  const items = [
    { value: "none", label: m.tournaments_roster_region_none() },
    ...(byCategory.get("region") ?? []).map((tag) => ({ value: tag.slug, label: tag.label })),
  ];
  return (
    <SimpleSelect
      items={items}
      value={value}
      onChange={onChange}
      label={m.tournaments_roster_region_label()}
      placeholder={m.tournaments_roster_region_label()}
    />
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
    if (await runReportedMutation(() => addParticipant.mutateAsync({ id, displayName }))) {
      setName("");
      setOpen(false);
    }
  }

  function openDialog() {
    addParticipant.reset();
    setOpen(true);
  }

  return (
    <>
      <PageTopBarPrimaryButton onClick={openDialog}>
        <UserPlusIcon className="size-4" />
        {m.tournaments_roster_add_player()}
      </PageTopBarPrimaryButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogForm onSubmit={() => void submit()}>
            <DialogHeader>
              <DialogTitle>{m.tournaments_roster_add_player()}</DialogTitle>
              <DialogDescription>{m.tournaments_roster_add_player_description()}</DialogDescription>
            </DialogHeader>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder={m.tournaments_roster_player_name()}
              aria-label={m.tournaments_roster_player_name()}
            />
            <SaveError error={addParticipant.error} />
            <DialogFooter>
              <DialogCancel />
              <Button type="submit" disabled={!name.trim()} pending={addParticipant.isPending}>
                {m.tournaments_roster_add()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
