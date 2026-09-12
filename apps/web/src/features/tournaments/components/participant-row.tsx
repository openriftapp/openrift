import type { TournamentParticipantResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import {
  ArmchairIcon,
  CheckIcon,
  CopyIcon,
  CrownIcon,
  EllipsisVerticalIcon,
  GlobeIcon,
  LayersIcon,
  Link2Icon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UnlinkIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardRow } from "@/components/ui/card-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { participantStatusLabels } from "@/features/tournaments/lib/tournament-display";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useRegionLabel } from "@/hooks/use-region-label";
import { getSiteUrl } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export type ParticipantAction =
  | "drop"
  | "reactivate"
  | "approve"
  | "deny"
  | "remove"
  | "unlink"
  | "reissue";

export interface ParticipantTarget {
  participantId: string;
  name: string;
}

export function participantMissesRegion(
  participant: TournamentParticipantResponse,
  regionsEnabled: boolean,
): boolean {
  return regionsEnabled && participant.status === "active" && participant.region === null;
}

function participantMissesLegend(
  participant: TournamentParticipantResponse,
  legendTiebreak: boolean,
): boolean {
  return legendTiebreak && participant.status === "active" && participant.legendCardId === null;
}

function statusBadgeVariant(status: TournamentParticipantResponse["status"]) {
  return status === "active" ? ("secondary" as const) : ("outline" as const);
}

export interface ParticipantRowProps {
  participant: TournamentParticipantResponse;
  tournamentId: string;
  regionsEnabled: boolean;
  manage: boolean;
  canAssignRegion: boolean;
  canAssignLegend?: boolean;
  legendTiebreak?: boolean;
  dimmed?: boolean;
  teammateName?: string;
  deckEntryId?: string;
  actionPending: boolean;
  onAction: (participantId: string, action: ParticipantAction) => void;
  onRename: (target: ParticipantTarget) => void;
  onSetLegend?: (target: ParticipantTarget & { legendName: string | null }) => void;
  onSetRegion: (target: ParticipantTarget & { region: string }) => void;
  onSetFixedTable: (target: ParticipantTarget & { fixedTable: string }) => void;
  onRemove: (target: ParticipantTarget) => void;
}

export function ParticipantRow({
  participant,
  tournamentId,
  regionsEnabled,
  manage,
  canAssignRegion,
  canAssignLegend = false,
  legendTiebreak = false,
  dimmed = false,
  teammateName,
  deckEntryId,
  actionPending,
  onAction,
  onRename,
  onSetLegend,
  onSetRegion,
  onSetFixedTable,
  onRemove,
}: ParticipantRowProps) {
  const regionLabel = useRegionLabel();
  const { copy } = useCopyToClipboard();
  const missesRegion = participantMissesRegion(participant, regionsEnabled);
  const missesLegend = participantMissesLegend(participant, legendTiebreak);
  const target: ParticipantTarget = {
    participantId: participant.id,
    name: participant.displayName,
  };

  async function handleCopyClaimLink() {
    const token = participant.claimToken;
    if (!token) {
      return;
    }
    if (await copy(`${getSiteUrl()}/tournaments/claim/${token}`)) {
      toast.success(m.tournaments_participant_claim_link_copied());
    } else {
      toast.error(m.tournaments_participant_claim_link_copy_failed());
    }
  }

  return (
    <CardRow className={cn("flex-wrap gap-3", dimmed && "opacity-50")}>
      <UserAvatar
        name={participant.userName ?? participant.displayName}
        className="size-9 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="truncate font-medium">{participant.displayName}</span>
        <Badge variant={statusBadgeVariant(participant.status)}>
          {participantStatusLabels()[participant.status]}
        </Badge>
        {teammateName ? (
          <Badge
            variant="outline"
            title={m.tournaments_participant_teamed_with({ name: teammateName })}
          >
            <UsersIcon className="size-3" />
            {teammateName}
          </Badge>
        ) : null}
        {regionsEnabled && participant.region ? (
          <Badge variant="outline">{regionLabel(participant.region)}</Badge>
        ) : missesRegion ? (
          <Badge variant="warning">
            <GlobeIcon className="size-3" />
            {m.tournaments_participant_no_region()}
          </Badge>
        ) : null}
        {participant.groupLabel === null ? null : (
          <Badge variant="info">
            {m.tournaments_group_heading({ label: participant.groupLabel })}
          </Badge>
        )}
        {participant.legendName ? (
          <Badge variant="subtle">
            <CrownIcon className="size-3" />
            {participant.legendName}
          </Badge>
        ) : missesLegend ? (
          <Badge variant="muted">
            <CrownIcon className="size-3" />
            {m.tournaments_participant_no_legend()}
          </Badge>
        ) : null}
        {participant.fixedTable === null ? null : (
          <Badge
            variant="outline"
            title={m.tournaments_participant_fixed_table_title({ table: participant.fixedTable })}
          >
            <ArmchairIcon className="size-3" />
            {m.tournaments_participant_table_badge({ table: participant.fixedTable })}
          </Badge>
        )}
        {participant.userId ? (
          <Badge
            variant="subtle"
            title={
              participant.userName
                ? m.tournaments_participant_linked_to_named({ name: participant.userName })
                : m.tournaments_participant_linked_to_account()
            }
          >
            <Link2Icon className="size-3" />
            {participant.userName ?? m.tournaments_participant_linked_badge()}
          </Badge>
        ) : null}
      </span>
      {manage ? (
        <span className="flex shrink-0 items-center gap-1">
          {missesRegion ? (
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => onSetRegion({ ...target, region: "none" })}
            >
              <GlobeIcon className="size-4" />
              {m.tournaments_missing_regions_set_region()}
            </Button>
          ) : null}
          {missesLegend && canAssignLegend && onSetLegend ? (
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => onSetLegend({ ...target, legendName: null })}
            >
              <CrownIcon className="size-4" />
              {m.tournaments_participant_set_legend()}
            </Button>
          ) : null}
          {deckEntryId ? (
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              render={
                <Link
                  to="/tournaments/$id/decks/$entryId"
                  params={{ id: tournamentId, entryId: deckEntryId }}
                />
              }
            >
              <LayersIcon className="size-4" />
              {m.tournaments_participant_deck()}
            </Button>
          ) : null}
          {participant.status === "requested" ? (
            <>
              <Button
                size="sm"
                aria-label={m.tournaments_participant_approve()}
                disabled={actionPending}
                onClick={() => onAction(participant.id, "approve")}
              >
                <CheckIcon className="size-4" />
                <span className="hidden sm:inline">{m.tournaments_participant_approve()}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={m.tournaments_participant_deny()}
                className="text-destructive"
                disabled={actionPending}
                onClick={() => onAction(participant.id, "deny")}
              >
                <XIcon className="size-4" />
                <span className="hidden sm:inline">{m.tournaments_participant_deny()}</span>
              </Button>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={m.tournaments_participant_actions()}
                />
              }
            >
              <EllipsisVerticalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {deckEntryId ? (
                <DropdownMenuItem
                  render={
                    <Link
                      to="/tournaments/$id/decks/$entryId"
                      params={{ id: tournamentId, entryId: deckEntryId }}
                    />
                  }
                >
                  <LayersIcon className="size-4" />
                  {m.tournaments_participant_deck()}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onRename(target)}>
                <PencilIcon className="size-4" />
                {m.tournaments_participant_rename()}
              </DropdownMenuItem>
              {canAssignRegion ? (
                <DropdownMenuItem
                  onClick={() => onSetRegion({ ...target, region: participant.region ?? "none" })}
                >
                  <GlobeIcon className="size-4" />
                  {m.tournaments_missing_regions_set_region()}
                </DropdownMenuItem>
              ) : null}
              {canAssignLegend && onSetLegend ? (
                <DropdownMenuItem
                  onClick={() => onSetLegend({ ...target, legendName: participant.legendName })}
                >
                  <CrownIcon className="size-4" />
                  {m.tournaments_participant_set_legend()}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  onSetFixedTable({
                    ...target,
                    fixedTable:
                      participant.fixedTable === null ? "" : String(participant.fixedTable),
                  })
                }
              >
                <ArmchairIcon className="size-4" />
                {m.tournaments_participant_set_fixed_table()}
              </DropdownMenuItem>
              {participant.status === "active" ? (
                <DropdownMenuItem
                  disabled={actionPending}
                  onClick={() => onAction(participant.id, "drop")}
                >
                  <UserMinusIcon className="size-4" />
                  {m.tournaments_participant_drop()}
                </DropdownMenuItem>
              ) : participant.status === "dropped" || participant.status === "no_show" ? (
                <DropdownMenuItem
                  disabled={actionPending}
                  onClick={() => onAction(participant.id, "reactivate")}
                >
                  <UserPlusIcon className="size-4" />
                  {m.tournaments_participant_reactivate()}
                </DropdownMenuItem>
              ) : null}
              {participant.userId ? (
                <DropdownMenuItem
                  disabled={actionPending}
                  onClick={() => onAction(participant.id, "unlink")}
                >
                  <UnlinkIcon className="size-4" />
                  {m.tournaments_participant_unlink()}
                </DropdownMenuItem>
              ) : participant.claimBlocked ? (
                <DropdownMenuItem
                  disabled={actionPending}
                  onClick={() => onAction(participant.id, "reissue")}
                >
                  <RotateCcwIcon className="size-4" />
                  {m.tournaments_participant_reissue_claim_link()}
                </DropdownMenuItem>
              ) : participant.claimToken ? (
                <DropdownMenuItem onClick={() => void handleCopyClaimLink()}>
                  <CopyIcon className="size-4" />
                  {m.tournaments_participant_copy_claim_link()}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(target)}>
                <Trash2Icon className="size-4" />
                {m.tournaments_participant_remove()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ) : canAssignRegion ? (
        <span className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant={missesRegion ? "outline" : "ghost"}
            onClick={() => onSetRegion({ ...target, region: participant.region ?? "none" })}
          >
            <GlobeIcon className="size-4" />
            {m.tournaments_missing_regions_set_region()}
          </Button>
        </span>
      ) : null}
    </CardRow>
  );
}
