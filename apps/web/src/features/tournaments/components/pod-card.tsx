import type { PairingWarning } from "@openrift/shared/pairing/warnings";
import type {
  PodMemberResponse,
  PodResponse,
  PodScoringScheme,
} from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRank } from "@/features/meta/lib/meta-format";
import { PlayerChip } from "@/features/tournaments/components/player-chip";
import { SaveError } from "@/features/tournaments/components/save-error";
import { usePodResultEditor } from "@/features/tournaments/hooks/use-pod-result-editor";
import { useResultBaseline } from "@/features/tournaments/hooks/use-result-baseline";
import {
  isDoubleForfeitPod,
  podForDisplay,
  isWalkoverPod,
} from "@/features/tournaments/lib/group-cut-units";
import { participantName } from "@/features/tournaments/lib/participant-name";
import { formatScore } from "@/features/tournaments/lib/standings-display";
import type { PodResultSubmission } from "@/features/tournaments/lib/swiss-results";
import { groupPodMembersByTeam, teamDisplayName } from "@/features/tournaments/lib/team-display";
import { isMatchPairing, pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { parseIntegerInput } from "@/lib/integer-input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { WarningBadge, WarningList } from "./pairing-warnings";
import { ChangedRemotelyNotice, PodResultForm } from "./pod-result-form";
import { SwissResultForm } from "./swiss-result-form";

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
  renderMemberDetail,
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
  renderMemberDetail?: (playerId: string) => ReactNode;
  onSubmit: (podId: string, submission: PodResultSubmission) => Promise<unknown>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<unknown>;
}) {
  const pod = podForDisplay(rawPod);
  const isMatch = teamMode || isMatchPairing(pod.size);
  const [scoringPlayerId, setScoringPlayerId] = useState<string | null>(null);
  const { changedRemotely, acceptLatest, resync, adoptSaved } = useResultBaseline(
    pod,
    scoringPlayerId,
  );
  const [scoreDraft, setScoreDraft] = useState("");
  const reported = pod.resultStatus === "reported";
  const walkover = isWalkoverPod(pod);
  const selfEntry = canEnter && onSubmitPlayerResult !== undefined && !walkover && !isMatch;
  const enteredCount = pod.members.filter((member) => member.gamePoints !== null).length;
  const penaltySummary = pod.penalty ? podPenaltySummary(pod.penalty) : null;
  const editor = usePodResultEditor(
    (submission) => onSubmit(pod.id, submission),
    (submission) => adoptSaved(submission.results, submission.drawnGames),
  );

  function startScoring(member: PodMemberResponse) {
    resync();
    editor.clearError();
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
    const ok = await editor.run(() => onSubmitPlayerResult(pod.id, scoringPlayerId, parsed));
    if (ok) {
      adoptSaved([{ playerId: scoringPlayerId, gamePoints: parsed }]);
      setScoringPlayerId(null);
    }
  }

  /** In 2v2 the result lives on the side's first member and teammates mirror it. */
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
            disabled={editor.saving || typeof parseIntegerInput(scoreDraft, 0) !== "number"}
            aria-label={m.tournaments_pod_save_score_aria({ name })}
          >
            <CheckIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setScoringPlayerId(null)}
            disabled={editor.saving}
            aria-label={m.tournaments_pod_cancel_score_aria()}
          >
            <XIcon />
          </Button>
        </span>
      ) : null;
    const winner = reported && lead.placement === 1;
    const behind = reported && lead.placement !== null && lead.placement > 1;
    const placed = !isMatch && reported && lead.placement !== null;
    const scoreFigure =
      lead.gamePoints === null ? null : (
        <span
          className={cn(
            "w-6 text-right tabular-nums",
            winner ? "font-semibold" : "text-muted-foreground",
          )}
          title={m.tournaments_pod_game_points_title({ points: lead.gamePoints })}
        >
          {lead.gamePoints}
        </span>
      );
    const pointsFigure =
      lead.points === null ? null : (
        <span
          className={cn(
            "w-7 text-right text-sm tabular-nums",
            winner && lead.points > 0 ? "text-primary" : "text-muted-foreground",
          )}
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

    return (
      <li
        key={lead.teamId ?? lead.playerId}
        className="flex items-center justify-between gap-2 px-3 py-2.5 not-last:border-b"
      >
        <div className="flex min-w-0 items-center gap-2">
          {placed && lead.placement !== null ? (
            <Badge
              variant={winner ? "subtle" : "neutral"}
              className="w-10 shrink-0 justify-center tabular-nums"
              title={m.tournaments_pod_finished_place({
                place: formatRank(lead.placement, false),
              })}
            >
              {formatRank(lead.placement, false)}
            </Badge>
          ) : null}
          <PlayerChip
            name={name}
            image={solo ? lead.image : null}
            gravatarHash={solo ? lead.gravatarHash : null}
            region={region}
            hideAvatar={placed}
            detail={solo ? renderMemberDetail?.(lead.playerId) : undefined}
            className={behind ? "text-muted-foreground" : undefined}
          />
        </div>
        {scoreEntry ?? (
          // shrink-0: without it a long name squeezes this cluster
          // until the numbers wrap mid-figure.
          <span className="flex shrink-0 items-center gap-2">
            {scoreAction}
            {scoreFigure}
            {pointsFigure}
          </span>
        )}
      </li>
    );
  }

  const footerAction = canEnter && !editor.editing;

  return (
    <Card className="gap-0 py-0">
      <div className="text-muted-foreground flex min-h-9 flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-xs font-semibold">
        <span className="whitespace-nowrap">{pairingLabel(pod.podNumber)}</span>
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-2 font-normal">
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
          ) : isMatch && !reported ? null : (
            <PodStatusBadge
              reported={reported}
              // A team shares one score, so reporting progress counts sides.
              enteredCount={teamMode ? Math.floor(enteredCount / 2) : enteredCount}
              size={teamMode ? 2 : pod.size}
            />
          )}
          {editor.editing ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={editor.handleCancel}
              disabled={editor.saving}
              aria-label={m.common_close()}
            >
              <XIcon />
            </Button>
          ) : null}
        </span>
      </div>
      {showPenalty && (penaltySummary || warningsExpanded) ? (
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          {penaltySummary ? (
            <p className="text-muted-foreground text-sm">{penaltySummary}</p>
          ) : null}
          {warningsExpanded ? <WarningList warnings={warnings} nameById={nameById} /> : null}
        </div>
      ) : null}
      {editor.editing ? (
        <div className="p-3">
          {isMatch ? (
            <SwissResultForm
              pod={pod}
              teamMatch={teamMode}
              matchFormat={matchFormat}
              winPoints={winPoints}
              drawPoints={drawPoints}
              allowDraws={allowDraws}
              onSubmit={(submission) => void editor.submit(submission)}
              submitting={editor.saving}
              error={editor.error}
            />
          ) : (
            <PodResultForm
              pod={pod}
              scheme={scheme}
              onSubmit={(results) => void editor.submit({ results })}
              submitting={editor.saving}
              error={editor.error}
            />
          )}
        </div>
      ) : (
        <>
          <ul className="flex flex-col">
            {(teamMode
              ? groupPodMembersByTeam(pod.members)
              : pod.members.map((member) => [member])
            ).flatMap((group, groupIndex) => [
              ...(teamMode && groupIndex > 0
                ? [
                    <li
                      key={`vs-${groupIndex}`}
                      aria-hidden="true"
                      className="text-muted-foreground/60 border-b py-0.5 text-center text-xs font-medium tracking-wide uppercase"
                    >
                      {m.tournaments_pod_vs()}
                    </li>,
                  ]
                : []),
              sideRow(group),
            ])}
          </ul>
          {scoringPlayerId !== null && (changedRemotely || editor.error) ? (
            <div className="flex flex-col gap-2 border-t px-3 py-2">
              {changedRemotely ? (
                <ChangedRemotelyNotice match={isMatch} onShowLatest={showLatestScore} />
              ) : null}
              <SaveError error={editor.error} />
            </div>
          ) : null}
          {footerAction ? (
            <div className="flex justify-end border-t px-3 py-2">
              <Button
                variant={reported ? "destructive" : "secondary"}
                size="sm"
                onClick={editor.handleStart}
              >
                {reported
                  ? m.tournaments_pod_edit_result()
                  : selfEntry
                    ? m.tournaments_pod_enter_all_scores()
                    : m.tournaments_pod_enter_result()}
              </Button>
            </div>
          ) : null}
        </>
      )}
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
