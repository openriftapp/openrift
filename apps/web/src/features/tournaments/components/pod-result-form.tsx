import { placementsFromGamePoints, pointsForPlacements } from "@openrift/shared/pairing/points";
import type { PodResponse, PodScoringScheme } from "@openrift/shared/types/api/pod-tournament";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRank } from "@/features/meta/lib/meta-format";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useResultBaseline } from "@/features/tournaments/hooks/use-result-baseline";
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
      {pod.members.map((member, index) => (
        // No flex-wrap: a long name would push the points field onto its own
        // line, breaking the column of inputs. The name truncates instead.
        <div key={member.playerId} className="flex items-center justify-between gap-x-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium" title={member.displayName}>
              {member.displayName}
            </span>
            {previewPoints && placements ? (
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatRank(placements[index] ?? 1, false)} · +
                {formatScore(previewPoints[index] ?? 0)}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Label htmlFor={`pts-${member.playerId}`} className="text-muted-foreground">
              {m.tournaments_pod_points_label()}
            </Label>
            <Input
              id={`pts-${member.playerId}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={points[member.playerId] ?? ""}
              onChange={(event) =>
                setPoints((prev) => ({ ...prev, [member.playerId]: event.target.value }))
              }
              className="w-20 tabular-nums"
            />
          </span>
        </div>
      ))}
      <p className="text-muted-foreground">{m.tournaments_pod_points_hint()}</p>
      {changedRemotely ? <ChangedRemotelyNotice onShowLatest={loadLatest} /> : null}
      <SaveError error={error} />
      <div className="flex justify-end gap-2">
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
