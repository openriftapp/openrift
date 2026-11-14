export function discardLabel(
  differences: number,
  provider: string,
  elsewhere?: string | null,
): string {
  const base = differences <= 1 ? "Discard" : `Discard ${differences} from ${provider}`;
  return elsewhere === null || elsewhere === undefined
    ? base
    : `${base} (also settles ${elsewhere})`;
}

export function primaryLabel(discardCount: number): string {
  return discardCount === 0 ? "Next" : `Discard ${discardCount} & next`;
}
