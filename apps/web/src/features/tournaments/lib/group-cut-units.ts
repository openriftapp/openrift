import { pairUnits } from "@openrift/shared/pairing/group-stage";
import type { GroupStageGroupView, PodResponse } from "@openrift/shared/types/api/pod-tournament";

import { m } from "@/paraglide/messages.js";

export interface GroupUnit {
  key: string;
  label: string;
  groups: GroupStageGroupView[];
  playerIds: string[];
  roundsStarted: number;
  currentRoundReported: boolean;
  canStartNextRound: boolean;
  done: boolean;
  paired: boolean;
}

function unitLabel(labels: readonly string[]): string {
  return m.tournaments_lib_group_unit_label({ labels: labels.join(" · ") });
}

export function groupUnits(groups: readonly GroupStageGroupView[]): GroupUnit[] {
  return pairUnits(
    groups,
    (group) => group.id,
    (group) => group.pairedGroupId,
    "solo",
  ).map((members) => ({
    key: members.map((member) => member.id).join("+"),
    label: unitLabel(members.map((member) => member.label)),
    groups: members,
    playerIds: members.flatMap((member) => member.playerIds),
    roundsStarted: Math.max(...members.map((member) => member.roundsStarted)),
    currentRoundReported: members.every((member) => member.currentRoundReported),
    canStartNextRound: members.every((member) => member.canStartNextRound),
    done: members.every((member) => member.done),
    paired: members.length > 1,
  }));
}

/** "Group C (round 2), Group D · E (round 3)": the groups the cut waits on. */
export function waitingUnitsLabel(units: readonly GroupUnit[]): string | null {
  const waiting = units.filter((unit) => !unit.done);
  if (waiting.length === 0) {
    return null;
  }
  return waiting
    .map((unit) =>
      m.tournaments_lib_group_waiting_unit({
        label: unit.label,
        number: Math.max(unit.roundsStarted, 1),
      }),
    )
    .join(", ");
}

export function groupLabelByPlayer(groups: readonly GroupStageGroupView[]): Map<string, string> {
  const byPlayer = new Map<string, string>();
  for (const group of groups) {
    for (const playerId of group.playerIds) {
      byPlayer.set(playerId, group.label);
    }
  }
  return byPlayer;
}

/** The two players sit in different groups, which only the paired pair does. */
export function isCrossGroupPod(pod: PodResponse, labelByPlayer: Map<string, string>): boolean {
  const labels = new Set(
    pod.members.flatMap((member) => {
      const label = labelByPlayer.get(member.playerId);
      return label === undefined ? [] : [label];
    }),
  );
  return labels.size > 1;
}

/** A forfeit: placements decide the match and no games were played. */
export function isWalkoverPod(pod: PodResponse): boolean {
  return (
    pod.members.length > 0 &&
    pod.members.every((member) => member.placement !== null && member.gamePoints === null)
  );
}

function podSideCount(pod: PodResponse): number {
  const teams = new Set(
    pod.members.flatMap((member) => (member.teamId === null ? [] : [member.teamId])),
  );
  return teams.size > 0 ? teams.size : pod.members.length;
}

function sharesOnePlacement(pod: PodResponse): boolean {
  const [first] = pod.members;
  return first !== undefined && pod.members.every((member) => member.placement === first.placement);
}

export function isDoubleForfeitPod(pod: PodResponse): boolean {
  return podSideCount(pod) === 2 && isWalkoverPod(pod) && sharesOnePlacement(pod);
}

export function isResultlessPod(pod: PodResponse): boolean {
  return podSideCount(pod) > 2 && isWalkoverPod(pod);
}

export function podForDisplay(pod: PodResponse): PodResponse {
  if (!isResultlessPod(pod)) {
    return pod;
  }
  return {
    ...pod,
    resultStatus: "pending",
    members: pod.members.map((member) => ({ ...member, placement: null, points: null })),
  };
}

/** "Ashe 2-0 Braum", "Ashe def. Braum" on a walkover, "Ashe vs Braum" unplayed. */
export function podScoreLine(pod: PodResponse): string {
  const ordered = pod.members.toSorted(
    (left, right) => (left.placement ?? 99) - (right.placement ?? 99),
  );
  const [first, second] = ordered;
  if (!first || !second) {
    return ordered.map((member) => member.displayName).join(` ${m.tournaments_pod_vs()} `);
  }
  if (first.placement === null || isResultlessPod(pod)) {
    return m.tournaments_lib_pod_score_vs({
      first: first.displayName,
      second: second.displayName,
    });
  }
  if (isWalkoverPod(pod)) {
    return isDoubleForfeitPod(pod)
      ? m.tournaments_lib_pod_score_both_forfeited({
          first: first.displayName,
          second: second.displayName,
        })
      : m.tournaments_lib_pod_score_defeated({
          first: first.displayName,
          second: second.displayName,
        });
  }
  return `${first.displayName} ${first.gamePoints ?? 0}-${second.gamePoints ?? 0} ${second.displayName}`;
}

/** "Round 1 · Ashe 2-0 Braum · Caitlyn 2-1 Darius" */
export function roundSummaryLine(roundNumber: number, pods: readonly PodResponse[]): string {
  return [
    m.tournaments_round_band_round({ number: roundNumber }),
    ...pods
      .toSorted((left, right) => left.podNumber - right.podNumber)
      .map((pod) => podScoreLine(pod)),
  ].join(" · ");
}

export function unitReportProgress(pods: readonly PodResponse[]): {
  reported: number;
  total: number;
} {
  return {
    reported: pods.filter((pod) => pod.resultStatus === "reported").length,
    total: pods.length,
  };
}
