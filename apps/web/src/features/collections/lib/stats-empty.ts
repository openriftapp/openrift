export type StatsBody = "loading" | "stats" | "empty" | "no-match";

export function statsBody(isReady: boolean, totalCopies: number, filterCount: number): StatsBody {
  if (!isReady) {
    return "loading";
  }
  if (totalCopies > 0) {
    return "stats";
  }
  return filterCount > 0 ? "no-match" : "empty";
}
