import type { MetaRunOutcome, MetaRunRound } from "@openrift/shared/types/api/meta";

/** A two-sided match neither side played: only tournament pods produce it, the archive never does. */
export type RunOutcome = MetaRunOutcome | "double_forfeit";

export type RunRound = Omit<MetaRunRound, "outcome"> & { outcome: RunOutcome };

export interface RunStripRound {
  phaseOrder: number;
  roundNumber: number;
  isCut: boolean;
  outcome: RunOutcome;
}
