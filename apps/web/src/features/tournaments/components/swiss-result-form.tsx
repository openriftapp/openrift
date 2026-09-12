import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { swissPointsPreview, swissResultPresets } from "@/features/tournaments/lib/swiss-results";
import { groupPodMembersByTeam, teamDisplayName } from "@/features/tournaments/lib/team-display";
import { m } from "@/paraglide/messages.js";

interface SwissResultFormProps {
  /** The first side of the scorelines is `members[0]`'s side. */
  pod: PodResponse;
  /** Treat the pod as a 2v2 team match (two sides of two players each). */
  teamMatch?: boolean;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  onSubmit: (results: { playerId: string; gamePoints: number }[]) => Promise<void> | void;
  submitting: boolean;
  onCancel?: () => void;
}

/** In 2v2, each side's score fans out to both of its players. */
export function SwissResultForm({
  pod,
  teamMatch = false,
  matchFormat,
  winPoints,
  drawPoints,
  onSubmit,
  submitting,
  onCancel,
}: SwissResultFormProps) {
  const groups = teamMatch
    ? groupPodMembersByTeam(pod.members)
    : pod.members.map((member) => [member]);
  const [side1, side2] = groups;
  const side1Name = side1 ? teamDisplayName(side1.map((member) => member.displayName)) : "";
  const side2Name = side2 ? teamDisplayName(side2.map((member) => member.displayName)) : "";
  const presets = swissResultPresets(matchFormat);
  const stored1 = side1?.[0]?.gamePoints ?? null;
  const stored2 = side2?.[0]?.gamePoints ?? null;
  const storedIndex = presets.findIndex(
    (preset) =>
      stored1 !== null &&
      stored2 !== null &&
      preset.gamePoints[0] === stored1 &&
      preset.gamePoints[1] === stored2,
  );
  const [selected, setSelected] = useState<number | null>(storedIndex === -1 ? null : storedIndex);
  const chosen = selected === null ? null : (presets[selected] ?? null);
  const preview = chosen ? swissPointsPreview(chosen.gamePoints, winPoints, drawPoints) : null;

  async function handleSubmit() {
    if (!chosen || !side1 || !side2) {
      return;
    }
    const results = [
      ...side1.map((member) => ({ playerId: member.playerId, gamePoints: chosen.gamePoints[0] })),
      ...side2.map((member) => ({ playerId: member.playerId, gamePoints: chosen.gamePoints[1] })),
    ];
    try {
      await onSubmit(results);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  if (!side1 || !side2 || groups.length !== 2) {
    return null;
  }

  const bo1 = matchFormat === "bo1";
  interface OutcomeEntry {
    index: number;
    label: string;
    aria: string;
  }
  const outcomeGroups = [
    {
      label: side1Name,
      aria: m.tournaments_submit_side_wins({ name: side1Name }),
      entries: [] as OutcomeEntry[],
    },
    {
      label: bo1 ? "" : m.tournaments_submit_draw(),
      aria: m.tournaments_submit_draw(),
      entries: [] as OutcomeEntry[],
    },
    {
      label: side2Name,
      aria: m.tournaments_submit_side_wins({ name: side2Name }),
      entries: [] as OutcomeEntry[],
    },
  ];
  presets.forEach((preset, index) => {
    const [one, two] = preset.gamePoints;
    const draw = one === two;
    const group = one > two ? outcomeGroups[0] : draw ? outcomeGroups[1] : outcomeGroups[2];
    if (!group) {
      return;
    }
    const scoreline = `${Math.max(one, two)}–${Math.min(one, two)}`;
    group.entries.push({
      index,
      label: bo1 ? (draw ? m.tournaments_submit_draw() : m.tournaments_submit_win()) : scoreline,
      aria: bo1 ? group.aria : `${group.aria} ${scoreline}`,
    });
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
        {outcomeGroups.map((group) => (
          <Fragment key={group.aria}>
            <span
              className="text-muted-foreground truncate text-sm"
              title={group.label || undefined}
            >
              {group.label}
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {group.entries.map((entry) => (
                <Button
                  key={entry.index}
                  variant={selected === entry.index ? "default" : "outline"}
                  size="sm"
                  className="tabular-nums"
                  onClick={() => setSelected(entry.index)}
                  disabled={submitting}
                  // The visible label repeats across the win rows ("1–0" or
                  // "Win" on either side), so the accessible name carries the
                  // outcome.
                  aria-label={entry.aria}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      {preview ? (
        <div className="text-muted-foreground grid w-fit grid-cols-[auto_auto] gap-x-4 text-sm tabular-nums">
          <span>{side1Name}</span>
          <span className="text-right">
            {m.tournaments_submit_points_preview({ points: preview[0] })}
          </span>
          <span>{side2Name}</span>
          <span className="text-right">
            {m.tournaments_submit_points_preview({ points: preview[1] })}
          </span>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {m.common_cancel()}
          </Button>
        ) : null}
        <Button onClick={() => void handleSubmit()} disabled={selected === null || submitting}>
          {submitting ? m.common_saving() : m.tournaments_submit_save_result()}
        </Button>
      </div>
    </div>
  );
}
