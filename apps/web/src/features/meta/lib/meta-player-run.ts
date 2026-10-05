import type { MetaRunRound } from "@openrift/shared/types/api/meta";

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
