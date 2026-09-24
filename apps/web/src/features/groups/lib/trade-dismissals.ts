import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";

export function dismissalKey(dismissal: TradeSuggestionDismissal): string {
  return `${dismissal.direction}\0${dismissal.counterpartyUserId}\0${dismissal.printingId}`;
}

export function dismissalKeys(dismissals: readonly TradeSuggestionDismissal[]): Set<string> {
  return new Set(dismissals.map((dismissal) => dismissalKey(dismissal)));
}

export function withDismissals(
  current: readonly TradeSuggestionDismissal[],
  added: readonly TradeSuggestionDismissal[],
): TradeSuggestionDismissal[] {
  const known = dismissalKeys(current);
  return [...current, ...added.filter((dismissal) => !known.has(dismissalKey(dismissal)))];
}

export function withoutDismissal(
  current: readonly TradeSuggestionDismissal[],
  removed: TradeSuggestionDismissal,
): TradeSuggestionDismissal[] {
  const key = dismissalKey(removed);
  return current.filter((dismissal) => dismissalKey(dismissal) !== key);
}
