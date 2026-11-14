// Confirms sorting by the DB-computed `canonical_rank` integer is meaningfully
// faster than the old composite comparator, on realistic catalog sizes (~3k
// printings). Runs in steady-state: fixtures built once, sort array cloned per
// iteration so both benches measure the same work.

import type { Printing } from "@openrift/shared/types/catalog";
import { test } from "vitest";

import { buildSyntheticPrintings } from "@/test/synthetic-catalog";

const FINISH_ORDER = ["normal", "foil"] as const;

/** The old comparator, kept here only for comparison. */
function compareByFourAxes(a: Printing, b: Printing): number {
  const setCmp = a.setId.localeCompare(b.setId);
  if (setCmp !== 0) {
    return setCmp;
  }
  const codeCmp = a.shortCode.localeCompare(b.shortCode);
  if (codeCmp !== 0) {
    return codeCmp;
  }
  const aMarker = a.markers.length > 0 ? 1 : 0;
  const bMarker = b.markers.length > 0 ? 1 : 0;
  if (aMarker !== bMarker) {
    return aMarker - bMarker;
  }
  const aFinishIdx = FINISH_ORDER.indexOf(a.finish as (typeof FINISH_ORDER)[number]);
  const bFinishIdx = FINISH_ORDER.indexOf(b.finish as (typeof FINISH_ORDER)[number]);
  return aFinishIdx - bFinishIdx;
}

const printings = buildSyntheticPrintings();

test("printing canonical sort", async ({ bench }) => {
  await bench.compare(
    bench("old: 6-axis comparator over ~3k printings", () => {
      [...printings].sort(compareByFourAxes);
    }),
    bench("new: canonicalRank integer compare over ~3k printings", () => {
      [...printings].sort((a, b) => a.canonicalRank - b.canonicalRank);
    }),
  );
});
