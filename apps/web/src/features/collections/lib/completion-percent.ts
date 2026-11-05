export function formatOverallCompletion(owned: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }
  if (owned >= total) {
    return "100%";
  }
  return `${(Math.floor((owned / total) * 1000) / 10).toFixed(1)}%`;
}
