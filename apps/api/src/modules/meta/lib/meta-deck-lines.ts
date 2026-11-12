import { WellKnown } from "@openrift/shared/well-known";

export function legendFromDeckLines(
  lines: readonly { zone: string; cardName: string }[],
): string | null {
  return lines.find((line) => line.zone === WellKnown.deckZone.LEGEND)?.cardName ?? null;
}
