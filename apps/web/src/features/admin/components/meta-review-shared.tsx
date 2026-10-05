/** A finish as the review surfaces print it: the bare number, or `T4` for a cut tier. */
export function rankLabel(rank: number | null, rankIsTier: boolean | null): string {
  if (rank === null) {
    return "";
  }
  return rankIsTier === true ? `T${rank}` : String(rank);
}
