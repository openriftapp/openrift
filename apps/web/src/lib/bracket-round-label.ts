import { m } from "@/paraglide/messages.js";

/** `fromEnd` counts back from the final: 0 is the final, 1 the semifinals. */
export function bracketRoundLabel(fromEnd: number): string {
  const labels = [
    m.bracket_round_final(),
    m.bracket_round_semi(),
    m.bracket_round_quarter(),
    m.bracket_round_16(),
  ];
  return labels[fromEnd] ?? m.bracket_round_of_n({ count: String(2 ** (fromEnd + 1)) });
}

export function bracketRoundShortLabel(fromEnd: number): string {
  const labels = [
    m.bracket_round_final(),
    m.bracket_round_short_semi(),
    m.bracket_round_short_quarter(),
    m.bracket_round_short_16(),
  ];
  return labels[fromEnd] ?? bracketRoundLabel(fromEnd);
}

/** Ordered from the first round to the final. */
export function bracketRoundLabels(roundCount: number, short = false): string[] {
  const label = short ? bracketRoundShortLabel : bracketRoundLabel;
  return Array.from({ length: roundCount }, (_, index) => label(roundCount - 1 - index));
}
