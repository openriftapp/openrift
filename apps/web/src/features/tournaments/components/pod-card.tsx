import type { PairingWarning } from "@openrift/shared/pairing/warnings";
import type {
  PodMemberResponse,
  PodResponse,
  PodScoringScheme,
} from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { CheckIcon, PencilIcon, SwordsIcon, UsersIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { formatRank } from "@/features/meta/lib/meta-format";
import { PlayerChip } from "@/features/tournaments/components/player-chip";
import { RegionBadge } from "@/features/tournaments/components/region-badge";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useResultBaseline } from "@/features/tournaments/hooks/use-result-baseline";
import {
  isDoubleForfeitPod,
  podForDisplay,
  isWalkoverPod,
} from "@/features/tournaments/lib/group-cut-units";
import { participantName } from "@/features/tournaments/lib/participant-name";
import { formatScore } from "@/features/tournaments/lib/standings-display";
import type { PodResultEntry } from "@/features/tournaments/lib/swiss-results";
import { groupPodMembersByTeam, teamDisplayName } from "@/features/tournaments/lib/team-display";
import { isMatchPairing, pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { parseIntegerInput } from "@/lib/integer-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { WarningBadge, WarningList } from "./pairing-warnings";
import { ChangedRemotelyNotice, PodResultForm } from "./pod-result-form";
import { SwissResultForm } from "./swiss-result-form";

function MemberSeedBadge({
  placement,
  gamePoints,
}: {
  placement: number | null;
  gamePoints: number | null;
}) {
  if (placement === null && gamePoints === null) {
    return null;
  }
  return (
    <Badge variant="secondary" className="shrink-0 tabular-nums">
      {placement !== null && (
        <span title={m.tournaments_pod_finished_place({ place: formatRank(placement, false) })}>
          {placement}
        </span>
      )}
      {placement !== null && gamePoints !== null ? (
        <span aria-hidden="true" className="text-muted-foreground/60">
          ·
        </span>
      ) : null}
      {gamePoints !== null && (
        <span
          className="text-muted-foreground"
          title={m.tournaments_pod_game_points_title({ points: gamePoints })}
        >
          {m.tournaments_pod_game_points_short({ points: gamePoints })}
        </span>
      )}
    </Badge>
  );
}

// Omits zero-value figures: a clean pairing renders nothing.
function podPenaltySummary(penalty: NonNullable<PodResponse["penalty"]>): string | null {
  const parts: string[] = [];
  if (penalty.rematchPairs > 0) {
    parts.push(m.tournaments_pod_penalty_rematches({ count: penalty.rematchPairs }));
  }
  if (penalty.spread > 0) {
    parts.push(m.tournaments_pod_penalty_spread({ value: penalty.spread }));
  }
  if (Math.round(penalty.total) > 0) {
    parts.push(m.tournaments_pod_penalty_total({ value: Math.round(penalty.total) }));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PodCard({
  pod: rawPod,
  teamMode,
  scheme,
  matchFormat,
  winPoints,
  drawPoints,
  regionByPlayer,
  showPenalty,
  warnings,
  warningsExpanded,
  nameById,
  canEnter,
  crossGroup = false,
  allowDraws = true,
  title,
  layout = "row",
  renderMemberLeading,
  renderMemberBadge,
  onSubmit,
  onSubmitPlayerResult,
}: {
  pod: PodResponse;
  teamMode: boolean;
  scheme: PodScoringScheme;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  regionByPlayer?: Map<string, string | null>;
  showPenalty: boolean;
  warnings: PairingWarning[];
  warningsExpanded: boolean;
  nameById: Map<string, string>;
  canEnter: boolean;
  /** The paired 3-player groups' shared match. */
  crossGroup?: boolean;
  allowDraws?: boolean;
  title?: string;
  layout?: "row" | "stacked";
  /** Rendered before the player's face; the bracket puts the seed pill here. */
  renderMemberLeading?: (playerId: string) => ReactNode;
  renderMemberBadge?: (playerId: string) => ReactNode;
  onSubmit: (podId: string, results: PodResultEntry[]) => Promise<unknown>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<unknown>;
}) {
  const pod = podForDisplay(rawPod);
  const isMatch = teamMode || isMatchPairing(pod.size);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [scoringPlayerId, setScoringPlayerId] = useState<string | null>(null);
  const { changedRemotely, acceptLatest, resync, adoptSaved } = useResultBaseline(
    pod,
    scoringPlayerId,
  );
  const [scoreDraft, setScoreDraft] = useState("");
  const reported = pod.resultStatus === "reported";
  const walkover = isWalkoverPod(pod);
  const selfEntry = canEnter && onSubmitPlayerResult !== undefined && !walkover;
  const enteredCount = pod.members.filter((member) => member.gamePoints !== null).length;
  const penaltySummary = pod.penalty ? podPenaltySummary(pod.penalty) : null;
  const stacked = layout === "stacked";

  async function handleSubmit(results: PodResultEntry[]) {
    setSaving(true);
    setSaveError(null);
    const ok = await runReportedMutation(() => onSubmit(pod.id, results), setSaveError);
    setSaving(false);
    if (ok) {
      adoptSaved(results);
      setEditing(false);
    }
  }

  function startEditing() {
    setSaveError(null);
    setEditing(true);
  }

  function startScoring(member: PodMemberResponse) {
    resync();
    setSaveError(null);
    setScoringPlayerId(member.playerId);
    setScoreDraft(member.gamePoints === null ? "" : String(member.gamePoints));
  }

  function showLatestScore() {
    const latest = pod.members.find((member) => member.playerId === scoringPlayerId);
    acceptLatest();
    setScoreDraft(
      latest === undefined || latest.gamePoints === null ? "" : String(latest.gamePoints),
    );
  }

  async function handleSaveScore() {
    const parsed = parseIntegerInput(scoreDraft, 0);
    if (typeof parsed !== "number" || scoringPlayerId === null || !onSubmitPlayerResult) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    const ok = await runReportedMutation(
      () => onSubmitPlayerResult(pod.id, scoringPlayerId, parsed),
      setSaveError,
    );
    setSaving(false);
    if (ok) {
      adoptSaved([{ playerId: scoringPlayerId, gamePoints: parsed }]);
      setScoringPlayerId(null);
    }
  }

  // One row per side. In 2v2 the result lives on the side's first member and
  // teammates mirror it; a team never scores independently per player.
  function sideRow(members: PodMemberResponse[]) {
    const lead = members[0];
    if (!lead) {
      return null;
    }
    const name = teamDisplayName(members.map((member) => participantName(member.displayName)));
    const region = regionByPlayer?.get(lead.playerId);
    const solo = members.length === 1;
    const scoreEntry =
      selfEntry && scoringPlayerId === lead.playerId ? (
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the input appears from the tapped "Add score" button; focusing it is the point of the tap
            autoFocus
            value={scoreDraft}
            onChange={(event) => setScoreDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleSaveScore();
              }
            }}
            aria-label={m.tournaments_pod_game_points_aria({ name })}
            className="h-7 w-16 tabular-nums"
          />
          <Button
            size="icon-sm"
            onClick={() => void handleSaveScore()}
            disabled={saving || typeof parseIntegerInput(scoreDraft, 0) !== "number"}
            aria-label={m.tournaments_pod_save_score_aria({ name })}
          >
            <CheckIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setScoringPlayerId(null)}
            disabled={saving}
            aria-label={m.tournaments_pod_cancel_score_aria()}
          >
            <XIcon />
          </Button>
        </span>
      ) : null;
    const pointsFigure =
      lead.points === null ? null : (
        <span
          className={cn("font-semibold", stacked && "text-muted-foreground")}
          title={m.tournaments_pod_round_points_title({ points: formatScore(lead.points) })}
        >
          +{formatScore(lead.points)}
        </span>
      );
    const scoreAction = selfEntry ? (
      lead.gamePoints === null ? (
        <Button variant="secondary" size="xs" onClick={() => startScoring(lead)}>
          {m.tournaments_pod_add_score()}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => startScoring(lead)}
          aria-label={m.tournaments_pod_edit_score_aria({ name })}
        >
          <PencilIcon />
        </Button>
      )
    ) : null;

    if (stacked) {
      const winner = lead.placement === 1;
      const notes = renderMemberBadge?.(lead.playerId);
      return (
        <li key={lead.teamId ?? lead.playerId} className="flex items-center gap-2">
          {renderMemberLeading?.(lead.playerId)}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span
                data-slot="bracket-seat-name"
                className={cn("truncate", winner ? "font-semibold" : "font-medium")}
              >
                {name}
              </span>
              {region ? <RegionBadge region={region} /> : null}
            </span>
            {notes ? (
              <span className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                {notes}
              </span>
            ) : null}
          </div>
          {scoreEntry ?? (
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              {pointsFigure}
              {lead.gamePoints === null ? null : (
                <span
                  className={cn(
                    "w-6 text-right text-sm tabular-nums",
                    winner ? "font-semibold" : "text-muted-foreground",
                  )}
                  title={m.tournaments_pod_game_points_title({ points: lead.gamePoints })}
                >
                  {lead.gamePoints}
                </span>
              )}
              {scoreAction}
            </span>
          )}
        </li>
      );
    }

    return (
      <li key={lead.teamId ?? lead.playerId} className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {renderMemberLeading?.(lead.playerId)}
          {isMatch ? (
            lead.gamePoints === null ? null : (
              <Badge
                variant="secondary"
                className="shrink-0 tabular-nums"
                title={m.tournaments_pod_game_points_title({ points: lead.gamePoints })}
              >
                {lead.gamePoints}
              </Badge>
            )
          ) : (
            <MemberSeedBadge placement={lead.placement} gamePoints={lead.gamePoints} />
          )}
          <PlayerChip
            name={name}
            image={solo ? lead.image : null}
            gravatarHash={solo ? lead.gravatarHash : null}
            region={region}
          >
            {renderMemberBadge?.(lead.playerId)}
          </PlayerChip>
        </div>
        {scoreEntry ?? (
          // shrink-0: without it a long name squeezes this cluster
          // until the numbers wrap mid-figure.
          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            {pointsFigure}
            {scoreAction}
          </span>
        )}
      </li>
    );
  }

  return (
    <Card className="gap-3">
      <CardHeader className="gap-1">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <IconChip
            icon={isMatch ? SwordsIcon : UsersIcon}
            tone={reported ? "success" : "neutral"}
            size="sm"
            shape="round"
          />
          <span className="whitespace-nowrap">{title ?? pairingLabel(pod.podNumber)}</span>
          <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            {crossGroup ? <Badge variant="info">{m.tournaments_pod_cross_group()}</Badge> : null}
            {showPenalty && !warningsExpanded ? (
              <WarningBadge warnings={warnings} nameById={nameById} />
            ) : null}
            {walkover ? (
              <Badge variant="neutral">
                {isDoubleForfeitPod(pod)
                  ? m.tournaments_pod_double_forfeit()
                  : m.tournaments_pod_walkover()}
              </Badge>
            ) : (
              <PodStatusBadge
                reported={reported}
                // A team shares one score, so reporting progress counts sides.
                enteredCount={teamMode ? Math.floor(enteredCount / 2) : enteredCount}
                size={teamMode ? 2 : pod.size}
              />
            )}
          </span>
        </CardTitle>
        {showPenalty && penaltySummary ? (
          <p className="text-muted-foreground text-sm">{penaltySummary}</p>
        ) : null}
        {showPenalty && warningsExpanded ? (
          <WarningList warnings={warnings} nameById={nameById} />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          isMatch ? (
            <SwissResultForm
              pod={pod}
              teamMatch={teamMode}
              matchFormat={matchFormat}
              winPoints={winPoints}
              drawPoints={drawPoints}
              allowDraws={allowDraws}
              onSubmit={(results) => void handleSubmit(results)}
              submitting={saving}
              error={saveError}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <PodResultForm
              pod={pod}
              scheme={scheme}
              onSubmit={(results) => void handleSubmit(results)}
              submitting={saving}
              error={saveError}
              onCancel={() => setEditing(false)}
            />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {(teamMode
                ? groupPodMembersByTeam(pod.members)
                : pod.members.map((member) => [member])
              ).flatMap((group, groupIndex) => [
                ...(teamMode && groupIndex > 0
                  ? [
                      <li
                        key={`vs-${groupIndex}`}
                        aria-hidden="true"
                        className="text-muted-foreground/60 py-0.5 text-center text-xs font-medium tracking-wide uppercase"
                      >
                        {m.tournaments_pod_vs()}
                      </li>,
                    ]
                  : []),
                sideRow(group),
              ])}
            </ul>
            {scoringPlayerId !== null && changedRemotely ? (
              <ChangedRemotelyNotice match={isMatch} onShowLatest={showLatestScore} />
            ) : null}
            {scoringPlayerId === null ? null : <SaveError error={saveError} />}
            {canEnter ? (
              <Button
                variant={reported ? "destructive" : "secondary"}
                size="sm"
                className={cn("self-end")}
                onClick={startEditing}
              >
                {reported
                  ? m.tournaments_pod_edit_result()
                  : selfEntry
                    ? m.tournaments_pod_enter_all_scores()
                    : m.tournaments_pod_enter_result()}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PodStatusBadge({
  reported,
  enteredCount,
  size,
}: {
  reported: boolean;
  enteredCount: number;
  size: number;
}) {
  if (reported) {
    return <Badge variant="success">{m.tournaments_pod_reported()}</Badge>;
  }
  return (
    <Badge variant={enteredCount > 0 ? "warning" : "neutral"}>
      {m.tournaments_pod_entered_of({ entered: enteredCount, size })}
    </Badge>
  );
}
