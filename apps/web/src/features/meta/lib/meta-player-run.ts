import type { MetaRunRound } from "@openrift/shared/types/api/meta";

import { m } from "@/paraglide/messages.js";

export interface MetaRunRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** A bye counts as the win the standings credit it as. */
export function metaRunRecord(rounds: readonly MetaRunRound[]): MetaRunRecord {
  const record = { wins: 0, losses: 0, draws: 0 };
  for (const round of rounds) {
    if (round.outcome === "win" || round.outcome === "bye") {
      record.wins++;
    } else if (round.outcome === "loss") {
      record.losses++;
    } else if (round.outcome === "draw") {
      record.draws++;
    }
  }
  return record;
}

export function metaCutRoundLabel(roundNumber: number, lastRoundNumber: number): string {
  const fromEnd = lastRoundNumber - roundNumber;
  const labels = [
    m.meta_bracket_round_final(),
    m.meta_bracket_round_semifinal(),
    m.meta_bracket_round_quarterfinal(),
  ];
  return labels[fromEnd] ?? m.meta_bracket_top_n({ size: String(2 ** (fromEnd + 1)) });
}
