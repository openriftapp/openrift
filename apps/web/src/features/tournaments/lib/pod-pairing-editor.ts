import type { TeamSnapshotPlayer } from "@openrift/shared/pairing/team-units";
import type {
  PodRoundResponse,
  PodSnapshotPlayer,
} from "@openrift/shared/types/api/pod-tournament";

import { m } from "@/paraglide/messages.js";

/** A pod in the manual editor: just the seated player ids (size is derived from length). */
interface EditorPod {
  playerIds: string[];
}

export interface EditorState {
  pods: EditorPod[];
  byes: string[];
}

export type MoveTarget = { kind: "pod"; index: number } | { kind: "newPod" } | { kind: "bye" };

/** The payload sent to the replace-pairing endpoint, with empty pods dropped. */
export interface PairingPayload {
  pods: { size: 2 | 3 | 4; playerIds: string[] }[];
  byes: string[];
}

/** `cut` is a Swiss-shaped bracket round: two per match, no byes, slot order fixed. */
export type EditorMode = "pod" | "swiss" | "team" | "cut";

export interface PartitionValidation {
  ok: boolean;
  podValid: boolean[];
  errors: string[];
}

export function seedFromRound(round: PodRoundResponse): EditorState {
  return {
    pods: round.pods.map((pod) => ({ playerIds: pod.members.map((member) => member.playerId) })),
    byes: round.byes.map((bye) => bye.playerId),
  };
}

export function participantIds(state: EditorState): string[] {
  return [...state.pods.flatMap((pod) => pod.playerIds), ...state.byes];
}

export function movePlayer(state: EditorState, playerId: string, target: MoveTarget): EditorState {
  const pods = state.pods.map((pod) => ({
    playerIds: pod.playerIds.filter((id) => id !== playerId),
  }));
  const byes = state.byes.filter((id) => id !== playerId);
  if (target.kind === "bye") {
    byes.push(playerId);
  } else if (target.kind === "newPod") {
    pods.push({ playerIds: [playerId] });
  } else {
    pods[target.index]?.playerIds.push(playerId);
  }
  return { pods, byes };
}

/** Every drop target the editor renders except the player's current spot; cut rounds have no new pod or bye zone. */
export function moveTargets(state: EditorState, playerId: string, mode: EditorMode): MoveTarget[] {
  const targets: MoveTarget[] = state.pods.flatMap((pod, index) =>
    pod.playerIds.includes(playerId) ? [] : [{ kind: "pod", index } as const],
  );
  if (mode === "cut") {
    return targets;
  }
  targets.push({ kind: "newPod" });
  if (!state.byes.includes(playerId)) {
    targets.push({ kind: "bye" });
  }
  return targets;
}

// Empty pods are ignored here; they are dropped on save in toPayload.
export function validatePartition(
  state: EditorState,
  expectedPlayerIds: readonly string[],
  mode: EditorMode = "pod",
): PartitionValidation {
  const errors: string[] = [];
  const sizeOk = (size: number): boolean =>
    mode === "pod" ? size === 3 || size === 4 : size === 2;
  const podValid = state.pods.map((pod) => {
    const size = pod.playerIds.length;
    return size === 0 || sizeOk(size);
  });
  state.pods.forEach((pod, index) => {
    const size = pod.playerIds.length;
    if (size !== 0 && !sizeOk(size)) {
      errors.push(
        mode === "team"
          ? m.tournaments_pairing_error_team_match({ match: index + 1, count: size })
          : mode === "swiss" || mode === "cut"
            ? m.tournaments_pairing_error_match_size({ match: index + 1, count: size })
            : m.tournaments_pairing_error_pod_size({ pod: index + 1, count: size }),
      );
    }
  });

  const seated = participantIds(state);
  const seatedSet = new Set(seated);
  if (seatedSet.size !== seated.length) {
    errors.push(
      mode === "team"
        ? m.tournaments_pairing_error_team_twice_match()
        : mode === "pod"
          ? m.tournaments_pairing_error_player_twice_pod()
          : m.tournaments_pairing_error_player_twice_match(),
    );
  }
  const expected = new Set(expectedPlayerIds);
  if (seatedSet.size !== expected.size || [...expected].some((id) => !seatedSet.has(id))) {
    errors.push(
      mode === "team"
        ? m.tournaments_pairing_error_team_unseated_match()
        : mode === "pod"
          ? m.tournaments_pairing_error_player_unseated_pod()
          : m.tournaments_pairing_error_player_unseated_match(),
    );
  }

  return { ok: errors.length === 0, podValid, errors };
}

// Assumes the state is valid (call validatePartition first); an out-of-range
// pod is coerced by length and the server re-validates anyway.
export function toPayload(state: EditorState): PairingPayload {
  return {
    pods: state.pods
      .filter((pod) => pod.playerIds.length > 0)
      .map((pod) => ({ size: pod.playerIds.length as 2 | 3 | 4, playerIds: pod.playerIds })),
    byes: state.byes,
  };
}

export function snapshotToPlayers(snapshot: PodSnapshotPlayer[]): TeamSnapshotPlayer[] {
  return snapshot.map((player) => ({
    id: player.playerId,
    teamId: player.teamId,
    score: player.score,
    pods3: player.pods3,
    pods4: player.pods4,
    byes: player.byes,
    opponents: new Map(Object.entries(player.opponents)),
    region: player.region,
    regionHistory: new Map(Object.entries(player.regionHistory)),
    fixedTable: player.fixedTable,
  }));
}
