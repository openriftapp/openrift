import { Fragment } from "react";

import type { MetaPlayerRound, MetaRoundOutcome } from "@/features/meta/lib/meta-player-run";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const OUTCOME_CLASS: Record<MetaRoundOutcome, string> = {
  win: "bg-success",
  loss: "bg-destructive",
  draw: "bg-muted-foreground/45",
  bye: "ring-muted-foreground/45 ring-1 ring-inset",
  unknown: "ring-muted-foreground/45 ring-1 ring-inset",
};

function outcomeWords(): Record<MetaRoundOutcome, string> {
  return {
    win: m.meta_outcome_word_win(),
    loss: m.meta_outcome_word_loss(),
    draw: m.meta_outcome_word_draw(),
    bye: m.meta_outcome_word_bye(),
    unknown: m.meta_outcome_word_none(),
  };
}

function words(rounds: readonly MetaPlayerRound[]): string {
  const labels = outcomeWords();
  return rounds.map((round) => labels[round.outcome]).join(", ");
}

export function runStripLabel(rounds: readonly MetaPlayerRound[]): string {
  const swiss = words(rounds.filter((round) => !round.isCut));
  const cut = words(rounds.filter((round) => round.isCut));
  if (swiss === "") {
    return cut === "" ? "" : m.meta_run_strip_cut_only({ cut });
  }
  if (cut === "") {
    return m.meta_run_strip_swiss_only({ swiss });
  }
  return m.meta_run_strip_full({ swiss, cut });
}

export function MetaRunStrip({
  rounds,
  className,
}: {
  rounds: readonly MetaPlayerRound[];
  className?: string;
}) {
  if (rounds.length === 0) {
    return null;
  }

  const firstCut = rounds.findIndex((round) => round.isCut);

  return (
    <span
      role="img"
      aria-label={runStripLabel(rounds)}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {rounds.map((round, index) => (
        <Fragment key={`${round.phaseOrder}:${round.roundNumber}`}>
          {index === firstCut && index > 0 && <span className="w-1 shrink-0" />}
          <span
            title={
              round.isCut
                ? m.meta_run_strip_cut_round({ number: String(round.roundNumber) })
                : m.meta_run_strip_round({ number: String(round.roundNumber) })
            }
            className={cn("size-2 shrink-0 rounded-[2px]", OUTCOME_CLASS[round.outcome])}
          />
        </Fragment>
      ))}
    </span>
  );
}
