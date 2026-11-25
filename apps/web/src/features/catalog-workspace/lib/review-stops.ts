import type { CardView } from "@/features/catalog-workspace/lib/workspace-search";

export type ReviewStop = { kind: "card" } | { kind: "printing"; printingId: string };

export type ListedStop = ReviewStop & { pending: boolean };

export interface ReviewTrail {
  cardSlug: string;
  queue?: CardView;
  cardIndex: number;
}

interface PassLike {
  rows: readonly { entry: { printing: { id: string } }; pending: boolean }[];
}

export function reviewStops(pass: PassLike): ListedStop[] {
  return [
    { kind: "card", pending: true },
    ...pass.rows.map((row): ListedStop => ({
      kind: "printing",
      printingId: row.entry.printing.id,
      pending: row.pending,
    })),
  ];
}

function sameStop(a: ReviewStop, b: ReviewStop): boolean {
  if (a.kind === "printing" && b.kind === "printing") {
    return a.printingId === b.printingId;
  }
  return a.kind === "card" && b.kind === "card";
}

export function nextPendingStop(
  stops: readonly ListedStop[],
  current: ReviewStop,
): ListedStop | null {
  const index = stops.findIndex((stop) => sameStop(stop, current));
  return stops.slice(index + 1).find((stop) => stop.pending) ?? null;
}

export function stopPosition(
  stops: readonly ListedStop[],
  current: ReviewStop,
): { index: number; total: number } {
  const counted = stops.filter((stop) => stop.pending || sameStop(stop, current));
  return {
    index: counted.findIndex((stop) => sameStop(stop, current)),
    total: counted.length,
  };
}
