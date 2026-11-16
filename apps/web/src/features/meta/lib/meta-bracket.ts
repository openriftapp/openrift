import { isSingleElimination } from "@openrift/shared/meta-standings";
import type {
  MetaEventMatch,
  MetaEventPhase,
  MetaEventPlayer,
} from "@openrift/shared/types/api/meta";

import { bracketMatchShortLabel, bracketRoundLabel } from "@/lib/bracket-round-label";
import { m } from "@/paraglide/messages.js";

export interface MetaBracketSeat {
  playerId: string | null;
  isWinner: boolean;
  gamesWon: number | null;
}

interface MetaBracketMatch {
  key: string;
  label: string | undefined;
  seats: [MetaBracketSeat, MetaBracketSeat];
}

interface MetaBracketRound {
  label: string;
  matches: MetaBracketMatch[];
  isFinal: boolean;
}

export interface MetaBracket {
  title: string;
  rounds: MetaBracketRound[];
}

/** Every player a seat can name, since the standings arrive one page at a time. */
export function bracketPlayers(
  ...lists: readonly (readonly MetaEventPlayer[])[]
): MetaEventPlayer[] {
  const byId = new Map<string, MetaEventPlayer>();
  for (const list of lists) {
    for (const player of list) {
      if (!byId.has(player.id)) {
        byId.set(player.id, player);
      }
    }
  }
  return [...byId.values()];
}

function toBracketMatch(match: MetaEventMatch, label: string | undefined): MetaBracketMatch {
  return {
    label,
    key: `${match.phaseOrder}:${match.roundNumber}:${match.tableNumber ?? "x"}:${match.player1Id}`,
    seats: [
      {
        playerId: match.player1Id,
        isWinner: match.winnerId === match.player1Id,
        gamesWon: match.gamesWonP1,
      },
      {
        playerId: match.player2Id,
        isWinner: match.player2Id !== null && match.winnerId === match.player2Id,
        gamesWon: match.gamesWonP2,
      },
    ],
  };
}

function roundsOfPhase(matches: readonly MetaEventMatch[], phaseOrder: number): MetaEventMatch[][] {
  const byRound = Map.groupBy(
    matches.filter((match) => match.phaseOrder === phaseOrder),
    (match) => match.roundNumber,
  );
  return [...byRound.keys()].toSorted((a, b) => a - b).map((number) => byRound.get(number) ?? []);
}

/**
 * Ranked by match count, not phase order: a third-place playoff is often
 * filed as its own single-elimination phase and would otherwise win by sitting last.
 */
function cutPhase(
  matches: readonly MetaEventMatch[],
  phases: readonly MetaEventPhase[],
): MetaEventPhase | null {
  let best: { phase: MetaEventPhase; matches: number } | null = null;
  for (const phase of phases) {
    if (!isSingleElimination(phase.roundType)) {
      continue;
    }
    const count = matches.filter((match) => match.phaseOrder === phase.phaseOrder).length;
    if (count > 0 && (best === null || count > best.matches)) {
      best = { phase, matches: count };
    }
  }
  return best?.phase ?? null;
}

/**
 * Sources list a round's matches in their own order; each goes to the slot its winner takes
 * next round. `placed` is false for a round where some match had no such slot.
 */
function inSlotOrder(rounds: readonly MetaEventMatch[][]): {
  rounds: MetaEventMatch[][];
  placed: boolean[];
} {
  const ordered = rounds.map((round) => [...round]);
  const placed = rounds.map(() => true);
  for (let index = ordered.length - 2; index >= 0; index -= 1) {
    const remaining = [...(ordered[index] ?? [])];
    const slots: (MetaEventMatch | undefined)[] = [];
    for (const next of ordered[index + 1] ?? []) {
      for (const playerId of [next.player1Id, next.player2Id]) {
        const at = remaining.findIndex((match) => playerId !== null && match.winnerId === playerId);
        slots.push(at === -1 ? undefined : remaining.splice(at, 1)[0]);
      }
    }
    placed[index] = remaining.length === 0;
    const leftovers = remaining.values();
    ordered[index] = [...slots.map((slot) => slot ?? leftovers.next().value), ...leftovers].filter(
      (match) => match !== undefined,
    );
  }
  return { rounds: ordered, placed };
}

/**
 * Fallback for a source with no phase list: accepted only when the last
 * phase's rounds halve down to a single match, so Swiss rounds never render as a bracket.
 */
function derivedRounds(matches: readonly MetaEventMatch[]): MetaEventMatch[][] {
  if (matches.length === 0) {
    return [];
  }
  const lastPhase = Math.max(...matches.map((match) => match.phaseOrder));
  const rounds = roundsOfPhase(matches, lastPhase);
  if (rounds.length < 2 || rounds.at(-1)?.length !== 1) {
    return [];
  }
  for (const [index, round] of rounds.entries()) {
    const nextRound = rounds[index + 1];
    if (nextRound !== undefined && round.length !== nextRound.length * 2) {
      return [];
    }
  }
  return rounds;
}

export function metaEventBracket(
  matches: readonly MetaEventMatch[],
  phases: readonly MetaEventPhase[] = [],
): MetaBracket | null {
  const phase = cutPhase(matches, phases);
  const rounds = phase === null ? derivedRounds(matches) : roundsOfPhase(matches, phase.phaseOrder);
  if (rounds.length === 0) {
    return null;
  }
  if (rounds.length < 2 && (phase === null || phase.rankRequired === null)) {
    return null;
  }

  const lastIndex = rounds.length - 1;
  const slotted = inSlotOrder(rounds);
  return {
    title: m.meta_bracket_top_n({ size: String(phase?.rankRequired ?? 2 ** rounds.length) }),
    rounds: slotted.rounds.map((round, index) => ({
      label: bracketRoundLabel(lastIndex - index),
      matches: round.map((match, slot) =>
        toBracketMatch(
          match,
          round.length === 2 ** (lastIndex - index) && slotted.placed[index]
            ? bracketMatchShortLabel(lastIndex - index, slot + 1)
            : undefined,
        ),
      ),
      // A last round with a third-place match beside the final isn't marked:
      // nothing in the payload says which of the two is which.
      isFinal: index === lastIndex && round.length === 1,
    })),
  };
}
