import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { useState } from "react";

import type { PodResultEntry } from "@/features/tournaments/lib/swiss-results";

type Points = number | null;

function knownPoints(pod: PodResponse): Record<string, Points[]> {
  return Object.fromEntries(pod.members.map((member) => [member.playerId, [member.gamePoints]]));
}

// A save resolves before the refetch lands, so until then both the stale value
// and the value just saved count as known.
export function useResultBaseline(
  pod: PodResponse,
  playerId?: string | null,
): {
  changedRemotely: boolean;
  acceptLatest: () => void;
  resync: () => void;
  adoptSaved: (results: readonly PodResultEntry[], drawnGames?: number) => void;
} {
  const [known, setKnown] = useState(() => knownPoints(pod));
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [knownDraws, setKnownDraws] = useState(() => [pod.drawnGames]);
  const wholePod = playerId === undefined || playerId === null;
  const compared = wholePod
    ? pod.members
    : pod.members.filter((member) => member.playerId === playerId);
  const changedRemotely =
    compared.some((member) => !(known[member.playerId] ?? []).includes(member.gamePoints)) ||
    (wholePod && !knownDraws.includes(pod.drawnGames));

  function acceptLatest() {
    setKnown(knownPoints(pod));
    setSaved({});
    setKnownDraws([pod.drawnGames]);
  }

  function resync() {
    const nextKnown: Record<string, Points[]> = {};
    const nextSaved: Record<string, number> = {};
    for (const member of pod.members) {
      const own = saved[member.playerId];
      const stale =
        own !== undefined &&
        member.gamePoints !== own &&
        (known[member.playerId] ?? []).includes(member.gamePoints);
      if (stale) {
        nextKnown[member.playerId] = [member.gamePoints, own];
        nextSaved[member.playerId] = own;
      } else {
        nextKnown[member.playerId] = [member.gamePoints];
      }
    }
    setKnown(nextKnown);
    setSaved(nextSaved);
  }

  function adoptSaved(results: readonly PodResultEntry[], drawnGames?: number) {
    if (drawnGames !== undefined) {
      setKnownDraws((current) => [...current, drawnGames]);
    }
    setKnown((current) => {
      const next = { ...current };
      for (const entry of results) {
        next[entry.playerId] = [...(next[entry.playerId] ?? []), entry.gamePoints];
      }
      return next;
    });
    setSaved((current) => ({
      ...current,
      ...Object.fromEntries(results.map((entry) => [entry.playerId, entry.gamePoints])),
    }));
  }

  return { changedRemotely, acceptLatest, resync, adoptSaved };
}
