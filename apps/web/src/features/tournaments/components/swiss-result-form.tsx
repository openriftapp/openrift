import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChangedRemotelyNotice } from "@/features/tournaments/components/pod-result-form";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useResultBaseline } from "@/features/tournaments/hooks/use-result-baseline";
import { participantName } from "@/features/tournaments/lib/participant-name";
import type {
  GameOutcome,
  GameRows,
  MatchCounts,
  PodResultSubmission,
} from "@/features/tournaments/lib/swiss-results";
import {
  INTENTIONAL_DRAW,
  countsFromGames,
  emptyGameRows,
  formatMatchCounts,
  gamesFromCounts,
  setGame,
  swissPointsPreview,
  visibleGameCount,
} from "@/features/tournaments/lib/swiss-results";
import { groupPodMembersByTeam, teamDisplayName } from "@/features/tournaments/lib/team-display";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SwissResultFormProps {
  pod: PodResponse;
  /** Treat the pod as a 2v2 team match (two sides of two players each). */
  teamMatch?: boolean;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  allowDraws?: boolean;
  showPoints?: boolean;
  onSubmit: (submission: PodResultSubmission) => void;
  submitting: boolean;
  error?: unknown;
  onCancel?: () => void;
}

function isIntentionalDraw(counts: MatchCounts): boolean {
  return (
    counts.gamePoints[0] === 0 &&
    counts.gamePoints[1] === 0 &&
    counts.drawnGames === INTENTIONAL_DRAW.drawnGames
  );
}

/** In 2v2, each side's score fans out to both of its players. */
export function SwissResultForm({
  pod,
  teamMatch = false,
  matchFormat,
  winPoints,
  drawPoints,
  allowDraws = true,
  showPoints = true,
  onSubmit,
  submitting,
  error,
  onCancel,
}: SwissResultFormProps) {
  const groups = teamMatch
    ? groupPodMembersByTeam(pod.members)
    : pod.members.map((member) => [member]);
  const [side1, side2] = groups;
  const side1Name = side1
    ? teamDisplayName(side1.map((member) => participantName(member.displayName)))
    : "";
  const side2Name = side2
    ? teamDisplayName(side2.map((member) => participantName(member.displayName)))
    : "";
  const bo3 = matchFormat === "bo3";
  const offerIntentionalDraw = bo3 && allowDraws;
  const stored1 = side1?.[0]?.gamePoints ?? null;
  const stored2 = side2?.[0]?.gamePoints ?? null;
  const storedCounts: MatchCounts | null =
    stored1 === null || stored2 === null
      ? null
      : { gamePoints: [stored1, stored2], drawnGames: pod.drawnGames };
  const storedIntentional =
    offerIntentionalDraw && storedCounts !== null && isIntentionalDraw(storedCounts);
  const storedRows =
    (storedCounts !== null && !storedIntentional
      ? gamesFromCounts(storedCounts, matchFormat, allowDraws)
      : null) ?? emptyGameRows(matchFormat);
  const [rows, setRows] = useState<GameRows>(storedRows);
  const [intentional, setIntentional] = useState(storedIntentional);
  const { changedRemotely, acceptLatest } = useResultBaseline(pod);
  const counts = intentional ? INTENTIONAL_DRAW : countsFromGames(rows, matchFormat, allowDraws);
  const preview = counts ? swissPointsPreview(counts.gamePoints, winPoints, drawPoints) : null;
  const visible = visibleGameCount(rows, matchFormat);
  const filledIn = allowDraws ? null : countsFromGames(rows, matchFormat, true);
  const tiedWithoutDraws = filledIn !== null && filledIn.gamePoints[0] === filledIn.gamePoints[1];

  function handleSubmit() {
    if (!counts || !side1 || !side2) {
      return;
    }
    onSubmit({
      results: [
        ...side1.map((member) => ({ playerId: member.playerId, gamePoints: counts.gamePoints[0] })),
        ...side2.map((member) => ({ playerId: member.playerId, gamePoints: counts.gamePoints[1] })),
      ],
      drawnGames: counts.drawnGames,
    });
  }

  function loadLatest() {
    acceptLatest();
    setRows(storedRows);
    setIntentional(storedIntentional);
  }

  if (!side1 || !side2 || groups.length !== 2) {
    return null;
  }

  const outcomeLabels: Record<GameOutcome, string> = {
    first: side1Name,
    second: side2Name,
    draw: m.tournaments_submit_draw(),
    unplayed: m.tournaments_submit_not_played(),
  };

  return (
    <div className="flex flex-col gap-3">
      {offerIntentionalDraw ? (
        <Toggle
          variant="outline"
          size="sm"
          pressed={intentional}
          onPressedChange={setIntentional}
          disabled={submitting}
          className="self-start"
        >
          {m.tournaments_submit_intentional_draw()}
        </Toggle>
      ) : null}
      {intentional ? null : (
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          {rows.slice(0, visible).map((game, index) => {
            const number = index + 1;
            const options: GameOutcome[] = [
              "first",
              ...(allowDraws ? (["draw"] as const) : []),
              "second",
              ...(bo3 && index > 0 ? (["unplayed"] as const) : []),
            ];
            return (
              <Fragment key={number}>
                <span className="text-muted-foreground text-sm">
                  {m.tournaments_submit_game({ number })}
                </span>
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  value={game === null ? [] : [game]}
                  onValueChange={(next) => {
                    const [value] = next;
                    if (value !== undefined) {
                      setRows(setGame(rows, index, value as GameOutcome, matchFormat));
                    }
                  }}
                  disabled={submitting}
                  className="flex flex-wrap justify-end gap-1.5"
                >
                  {options.map((outcome) => (
                    <ToggleGroupItem
                      key={outcome}
                      value={outcome}
                      className="max-w-40"
                      title={outcomeLabels[outcome]}
                      aria-label={m.tournaments_submit_game_outcome_aria({
                        number,
                        outcome: outcomeLabels[outcome],
                      })}
                    >
                      <span className="truncate">{outcomeLabels[outcome]}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Fragment>
            );
          })}
        </div>
      )}
      {tiedWithoutDraws ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_submit_needs_winner()}</p>
      ) : null}
      {counts && preview ? (
        <div
          className={cn(
            "text-muted-foreground grid max-w-full gap-x-4 text-sm tabular-nums",
            showPoints ? "grid-cols-[minmax(0,auto)_auto_auto]" : "grid-cols-[minmax(0,auto)_auto]",
          )}
        >
          <span className="min-w-0 truncate">{side1Name}</span>
          <span>{formatMatchCounts(counts)}</span>
          {showPoints ? (
            <span className="text-right">
              {m.tournaments_submit_points_preview({ points: preview[0] })}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{side2Name}</span>
          <span>
            {formatMatchCounts({
              gamePoints: [counts.gamePoints[1], counts.gamePoints[0]],
              drawnGames: counts.drawnGames,
            })}
          </span>
          {showPoints ? (
            <span className="text-right">
              {m.tournaments_submit_points_preview({ points: preview[1] })}
            </span>
          ) : null}
        </div>
      ) : null}
      {changedRemotely ? <ChangedRemotelyNotice match onShowLatest={loadLatest} /> : null}
      <SaveError error={error} />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {m.common_cancel()}
          </Button>
        ) : null}
        <Button onClick={handleSubmit} disabled={counts === null} pending={submitting}>
          {m.tournaments_pod_save_result()}
        </Button>
      </div>
    </div>
  );
}
