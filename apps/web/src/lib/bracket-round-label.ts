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
export function bracketRoundLabels(roundCount: number): string[] {
  return Array.from({ length: roundCount }, (_, index) =>
    bracketRoundLabel(roundCount - 1 - index),
  );
}

/** "QF 2"; the final carries no number. */
export function bracketMatchShortLabel(fromEnd: number, number: number): string {
  const label = bracketRoundShortLabel(fromEnd);
  return fromEnd === 0 ? label : m.tournaments_lib_cut_match_short({ label, number });
}
