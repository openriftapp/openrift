export function flooredPercent(owned: number, total: number, decimals: 0 | 1): string {
  if (total <= 0) {
    return "0";
  }
  if (owned >= total) {
    return "100";
  }
  const scale = 10 ** decimals;
  return (Math.floor((owned * scale * 100) / total) / scale).toFixed(decimals);
}

export function formatCompletionPercent(owned: number, total: number, decimals: 0 | 1 = 1): string {
  return `${flooredPercent(owned, total, decimals)}%`;
}
