import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
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
  clearGame,
  endAtOpenGame,
  countsFromGames,
  emptyGameRows,
  gamesFromCounts,
  setGame,
  swissPointsPreview,
  visibleGameCount,
  withoutUnplayed,
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
  const [rows, setRows] = useState<GameRows>(withoutUnplayed(storedRows));
  const [intentional, setIntentional] = useState(storedIntentional);
  const { changedRemotely, acceptLatest } = useResultBaseline(pod);
  const cutShort = endAtOpenGame(rows, matchFormat);
  const played = cutShort ?? rows;
  const [confirmingCut, setConfirmingCut] = useState(false);
  const counts = intentional ? INTENTIONAL_DRAW : countsFromGames(played, matchFormat, allowDraws);
  const preview = counts ? swissPointsPreview(counts.gamePoints, winPoints, drawPoints) : null;
  const visible = visibleGameCount(rows, matchFormat);
  const filledIn = allowDraws ? null : countsFromGames(played, matchFormat, true);
  const tiedWithoutDraws = filledIn !== null && filledIn.gamePoints[0] === filledIn.gamePoints[1];

  function handleSave() {
    const unchanged =
      counts !== null &&
      storedCounts !== null &&
      counts.gamePoints[0] === storedCounts.gamePoints[0] &&
      counts.gamePoints[1] === storedCounts.gamePoints[1] &&
      counts.drawnGames === storedCounts.drawnGames;
    if (counts && !intentional && cutShort !== null && !unchanged) {
      setConfirmingCut(true);
      return;
    }
    handleSubmit();
  }

  function handleSubmit() {
    setConfirmingCut(false);
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
    setRows(withoutUnplayed(storedRows));
    setIntentional(storedIntentional);
  }

  if (!side1 || !side2 || groups.length !== 2) {
    return null;
  }

  const outcomeLabels: Record<SheetOutcome, string> = {
    first: side1Name,
    second: side2Name,
    draw: m.tournaments_submit_draw(),
  };
  const shown = played.slice(0, visibleGameCount(played, matchFormat));
  const totals: Record<SheetOutcome, number> = {
    first: shown.filter((game) => game === "first").length,
    second: shown.filter((game) => game === "second").length,
    draw: shown.filter((game) => game === "draw").length,
  };
  const sheetRows: { outcome: SheetOutcome; label: ReactNode }[] = [
    { outcome: "first", label: <SideName name={side1Name} /> },
    { outcome: "second", label: <SideName name={side2Name} /> },
    ...(allowDraws
      ? [{ outcome: "draw" as const, label: <SheetRowLabel>{outcomeLabels.draw}</SheetRowLabel> }]
      : []),
  ];
  const sidePoints: Partial<Record<SheetOutcome, number>> =
    showPoints && preview ? { first: preview[0], second: preview[1] } : {};

  return (
    <div className="flex flex-col gap-3">
      {intentional ? null : (
        <div
          className={cn(
            "grid w-full items-center gap-x-1.5 gap-y-2",
            SHEET_COLUMNS[bo3 ? "bo3" : "bo1"][showPoints ? "points" : "plain"],
          )}
        >
          <span />
          {rows.map((_, index) =>
            index < visible ? (
              <span
                key={index}
                className="text-muted-foreground text-center text-xs font-medium"
                title={m.tournaments_submit_game({ number: index + 1 })}
              >
                {m.tournaments_submit_game_short({ number: index + 1 })}
              </span>
            ) : (
              <span key={index} />
            ),
          )}
          <span />
          {showPoints ? <span /> : null}
          {sheetRows.map(({ outcome, label }) => {
            const side = outcome === "first" || outcome === "second";
            return (
              <Fragment key={outcome}>
                {label}
                {rows.map((game, index) => {
                  if (index >= visible) {
                    return <span key={index} />;
                  }
                  const number = index + 1;
                  return (
                    <Toggle
                      key={index}
                      variant="outline"
                      size="sm"
                      pressed={game === outcome}
                      onPressedChange={(pressed) =>
                        setRows(
                          pressed
                            ? setGame(rows, index, outcome, matchFormat)
                            : clearGame(rows, index),
                        )
                      }
                      disabled={submitting}
                      aria-label={m.tournaments_submit_game_outcome_aria({
                        number,
                        outcome: outcomeLabels[outcome],
                      })}
                      className={cn(
                        "w-full",
                        side
                          ? "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
                          : "h-7",
                      )}
                    >
                      {game === outcome ? <CheckIcon /> : null}
                    </Toggle>
                  );
                })}
                <span
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    outcome === "draw" && "text-muted-foreground text-sm font-normal",
                  )}
                >
                  {totals[outcome]}
                </span>
                {showPoints ? (
                  <span className="text-muted-foreground text-right text-sm tabular-nums">
                    {sidePoints[outcome] === undefined
                      ? null
                      : m.tournaments_submit_points_preview({ points: sidePoints[outcome] })}
                  </span>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}
      {tiedWithoutDraws ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_submit_needs_winner()}</p>
      ) : null}
      {changedRemotely ? <ChangedRemotelyNotice match onShowLatest={loadLatest} /> : null}
      <SaveError error={error} />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {offerIntentionalDraw ? (
          <Toggle
            variant="outline"
            size="sm"
            pressed={intentional}
            onPressedChange={setIntentional}
            disabled={submitting}
            className="mr-auto"
          >
            {m.tournaments_submit_intentional_draw()}
          </Toggle>
        ) : null}
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {m.common_cancel()}
          </Button>
        ) : null}
        <Button onClick={handleSave} disabled={counts === null} pending={submitting}>
          {m.tournaments_pod_save_result()}
        </Button>
      </div>
      {counts ? (
        <ConfirmActionDialog
          open={confirmingCut}
          onOpenChange={setConfirmingCut}
          onConfirm={handleSubmit}
          destructive={false}
          title={m.tournaments_submit_cut_short_title()}
          description={m.tournaments_submit_cut_short_description({
            number: rows.indexOf(null) + 1,
            first: side1Name,
            second: side2Name,
            score: `${counts.gamePoints[0]}–${counts.gamePoints[1]}`,
          })}
          confirmLabel={m.tournaments_pod_save_result()}
        />
      ) : null}
    </div>
  );
}

type SheetOutcome = Exclude<GameOutcome, "unplayed">;

const SHEET_COLUMNS = {
  bo1: {
    plain: "grid-cols-[minmax(0,1fr)_2.5rem_1.5rem]",
    points: "grid-cols-[minmax(0,1fr)_2.5rem_1.5rem_auto]",
  },
  bo3: {
    plain: "grid-cols-[minmax(0,1fr)_repeat(3,2.5rem)_1.5rem]",
    points: "grid-cols-[minmax(0,1fr)_repeat(3,2.5rem)_1.5rem_auto]",
  },
} as const;

function SheetRowLabel({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground truncate text-right text-sm">{children}</span>;
}

function SideName({ name }: { name: string }) {
  return (
    <span className="truncate font-medium" title={name}>
      {name}
    </span>
  );
}
