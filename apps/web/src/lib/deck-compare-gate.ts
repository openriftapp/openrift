import { redirect } from "@tanstack/react-router";

import { bareLocalDeckId } from "@/features/decks/lib/local-deck";

function compareSide(value: unknown): string | undefined {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return typeof value === "string" ? value : undefined;
}

export function redirectLegacyCompareSides(location: {
  pathname: string;
  search: Record<string, unknown>;
}): void {
  if (location.pathname !== "/decks/compare") {
    return;
  }
  const from = compareSide(location.search.from);
  const to = compareSide(location.search.to);
  const bareFrom = from === undefined ? undefined : bareLocalDeckId(from);
  const bareTo = to === undefined ? undefined : bareLocalDeckId(to);
  if (bareFrom !== from || bareTo !== to) {
    throw redirect({ to: "/decks/compare", search: { from: bareFrom, to: bareTo }, replace: true });
  }
}
