import { BOOSTERS } from "@openrift/shared/boosters/definitions";
import { boosterChannelSlugs, toBoosterPrintings } from "@openrift/shared/boosters/input";
import { boosterRowsForPrinting } from "@openrift/shared/boosters/resolve";
import type { BoosterRow } from "@openrift/shared/boosters/types";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { BoosterFoundInLine } from "@/features/boosters/components/booster-found-in-line";
import { useSets } from "@/features/cards/hooks/use-sets";
import { publicSetDetailQueryOptions } from "@/features/cards/lib/public-sets-queries";

export interface DeskPackOddsDraft {
  setId: string;
  language: string;
  size: string;
  finish: string;
  markerSlugs: readonly string[];
  channelSlugs: readonly string[];
}

function rowKey(row: BoosterRow): string {
  return `${row.booster}|${row.slot}|${row.outcome}`;
}

export function PrintingDeskPackOdds({
  existing,
  draft,
}: {
  existing: DeskPrintingRow;
  draft: DeskPackOddsDraft;
}) {
  const { data: setsData } = useSets();
  const { data: channelData } = useDistributionChannels();
  const draftSet = setsData.sets.find((set) => set.id === draft.setId) ?? {
    slug: existing.setSlug,
    name: existing.setName,
  };
  const before = useQuery(publicSetDetailQueryOptions(existing.setSlug));
  const after = useQuery(publicSetDetailQueryOptions(draftSet.slug));
  if (!before.data || !after.data) {
    return null;
  }

  const beforePrintings = toBoosterPrintings(before.data.printings);
  const original = beforePrintings.find((p) => p.printingId === existing.printingId);
  if (!original) {
    return null;
  }
  const otherFaceMarked = before.data.printings.some(
    (p) => p.printingId === existing.printingId && p.side !== existing.side && p.markers.length > 0,
  );
  const fromBooster = boosterChannelSlugs(channelData.distributionChannels);
  const changed = {
    ...original,
    setSlug: draftSet.slug,
    language: draft.language,
    size: draft.size,
    ...(existing.side === 1 ? { finish: draft.finish } : {}),
    hasMarker: draft.markerSlugs.length > 0 || otherFaceMarked,
    hasChannel: draft.channelSlugs.some((slug) => !fromBooster.has(slug)),
    isPackExclusive: draft.channelSlugs.some((slug) => fromBooster.has(slug)),
  };
  const afterPrintings = [
    ...toBoosterPrintings(after.data.printings).filter((p) => p.printingId !== existing.printingId),
    changed,
  ];

  const beforeRows = boosterRowsForPrinting(beforePrintings, existing.printingId);
  const afterRows = boosterRowsForPrinting(afterPrintings, existing.printingId);
  const unchanged =
    beforeRows.map((row) => rowKey(row)).join(",") ===
    afterRows.map((row) => rowKey(row)).join(",");
  const setName = (row: BoosterRow) => {
    const slug = BOOSTERS[row.booster]?.set;
    return setsData.sets.find((set) => set.slug === slug)?.name ?? row.booster;
  };
  const list = (rows: BoosterRow[]) =>
    rows.length === 0 ? (
      <p className="text-muted-foreground">In no booster pack.</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <BoosterFoundInLine row={row} language={draft.language} setName={setName(row)} />
          </li>
        ))}
      </ul>
    );

  return (
    <Field>
      <FieldLabel>Booster packs</FieldLabel>
      {unchanged ? (
        list(afterRows)
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">Now</p>
          {list(beforeRows)}
          <p className="text-muted-foreground">After saving</p>
          {list(afterRows)}
          {beforeRows.length > 0 && afterRows.length === 0 && (
            <Alert variant="warning">
              <AlertDescription>
                Saving takes this printing out of every booster pack. Pack exclusives go under the
                booster channel.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Field>
  );
}
