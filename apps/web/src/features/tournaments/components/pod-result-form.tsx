import { placementsFromGamePoints, pointsForPlacements } from "@openrift/shared/pairing/points";
import type { PodResponse, PodScoringScheme } from "@openrift/shared/types/api/pod-tournament";
import { MinusIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRank } from "@/features/meta/lib/meta-format";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useResultBaseline } from "@/features/tournaments/hooks/use-result-baseline";
import { participantName } from "@/features/tournaments/lib/participant-name";
import { formatScore } from "@/features/tournaments/lib/standings-display";
import type { PodResultEntry } from "@/features/tournaments/lib/swiss-results";
import { parseIntegerInput } from "@/lib/integer-input";
import { m } from "@/paraglide/messages.js";

interface PodResultFormProps {
  pod: PodResponse;
  scheme: PodScoringScheme;
  onSubmit: (results: PodResultEntry[]) => void;
  submitting: boolean;
  error?: unknown;
  onCancel?: () => void;
}

export function ChangedRemotelyNotice({
  match = false,
  onShowLatest,
}: {
  match?: boolean;
  onShowLatest: () => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <TriangleAlertIcon className="text-warning size-4 shrink-0" />
        {match ? m.tournaments_match_changed_remotely() : m.tournaments_pod_changed_remotely()}
      </span>
      <Button variant="outline" size="sm" onClick={onShowLatest}>
        {m.tournaments_pod_show_latest()}
      </Button>
    </div>
  );
}

export function PodResultForm({
  pod,
  scheme,
  onSubmit,
  submitting,
  error,
  onCancel,
}: PodResultFormProps) {
  const [points, setPoints] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pod.members.map((member) => [
        member.playerId,
        member.gamePoints === null ? "" : String(member.gamePoints),
      ]),
    ),
  );
  const { changedRemotely, acceptLatest } = useResultBaseline(pod);
  const parsed = pod.members.map(
    (member) => parseIntegerInput(points[member.playerId] ?? "", 0) ?? null,
  );

  function loadLatest() {
    acceptLatest();
    setPoints(
      Object.fromEntries(
        pod.members.map((member) => [
          member.playerId,
          member.gamePoints === null ? "" : String(member.gamePoints),
        ]),
      ),
    );
  }
  const allSet = parsed.every((value) => value !== null);
  const placements = allSet ? placementsFromGamePoints(parsed as number[]) : null;
  // Swiss matches (size 2) use SwissResultForm instead; the placement tables
  // only exist for 3/4-pods, so guard the preview accordingly.
  const previewPoints =
    placements && pod.size !== 2 ? pointsForPlacements(placements, pod.size, scheme) : null;

  function stepPoints(playerId: string, current: number | null, delta: number) {
    setPoints((prev) => ({ ...prev, [playerId]: String(Math.max(0, (current ?? 0) + delta)) }));
  }

  function handleSubmit() {
    if (!allSet) {
      return;
    }
    onSubmit(
      pod.members.map((member, index) => ({
        playerId: member.playerId,
        gamePoints: parsed[index] as number,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-3 flex flex-col divide-y">
        {pod.members.map((member, index) => {
          const name = participantName(member.displayName);
          const value = parsed[index] ?? null;
          const place = placements?.[index];
          return (
            <div
              key={member.playerId}
              className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-x-3 px-3 py-2"
            >
              <span className="truncate font-medium" title={name}>
                {name}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={submitting || value === null || value <= 0}
                  onClick={() => stepPoints(member.playerId, value, -1)}
                  aria-label={m.tournaments_pod_points_lower_aria({ name })}
                >
                  <MinusIcon />
                </Button>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={points[member.playerId] ?? ""}
                  onChange={(event) =>
                    setPoints((prev) => ({ ...prev, [member.playerId]: event.target.value }))
                  }
                  aria-label={m.tournaments_pod_game_points_aria({ name })}
                  className="no-spinner h-8 w-12 text-center font-semibold tabular-nums"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={submitting}
                  onClick={() => stepPoints(member.playerId, value, 1)}
                  aria-label={m.tournaments_pod_points_raise_aria({ name })}
                >
                  <PlusIcon />
                </Button>
              </span>
              <span className="text-right text-sm whitespace-nowrap tabular-nums">
                {previewPoints && place !== undefined ? (
                  <>
                    <span className={place === 1 ? "text-primary font-semibold" : "font-medium"}>
                      {formatRank(place, false)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · +{formatScore(previewPoints[index] ?? 0)}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground">{m.tournaments_pod_points_hint()}</p>
      {changedRemotely ? <ChangedRemotelyNotice onShowLatest={loadLatest} /> : null}
      <SaveError error={error} />
      <div className="-mx-3 flex justify-end gap-2 border-t px-3 pt-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {m.common_cancel()}
          </Button>
        ) : null}
        <Button onClick={handleSubmit} disabled={!allSet} pending={submitting}>
          {m.tournaments_pod_save_result()}
        </Button>
      </div>
    </div>
  );
}
