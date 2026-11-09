import { legendDisplayName } from "@openrift/shared/card-name";
import { ZONE_LABELS } from "@openrift/shared/deck-zones";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SectionHeading } from "@/components/ui/section-heading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { printingCollectionSearch } from "@/features/cards/lib/printing-search-link";
import { useCollectionsList } from "@/features/collections/hooks/use-collections";
import { useOwnedCollectionsByVariants } from "@/features/collections/hooks/use-owned-count";
import { useDeckViolations } from "@/features/decks/hooks/use-deck-builder";
import type { UncoveredCopies } from "@/features/decks/lib/deck-card-detail-plan";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

export function DeckCardDetailHeader({
  deckId,
  format,
  formatConfig,
  cardId,
  zone,
  zones,
  onZoneChange,
  otherZones,
  missing,
}: {
  deckId: string;
  format: DeckFormat;
  formatConfig: DeckFormatConfig | null;
  cardId: string;
  zone: DeckZone;
  zones?: readonly { zone: DeckZone; count: number }[];
  onZoneChange?: (zone: DeckZone) => void;
  otherZones?: ReactNode;
  missing: number;
}) {
  const violations = useDeckViolations(deckId, format, formatConfig).filter(
    (violation) => violation.cardId === cardId,
  );
  const messages = [...new Set(violations.map((violation) => violation.message))];
  if (messages.length === 0 && !zones && missing === 0 && !otherZones) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length > 0 && (
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertDescription>
            {messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {(zones || missing > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {zones && !onZoneChange && (
            <span className="flex flex-wrap gap-x-3 text-sm">
              {zones.map((entry) => (
                <span key={entry.zone}>
                  {ZONE_LABELS[entry.zone]}
                  <span className="text-muted-foreground tabular-nums"> · {entry.count}</span>
                </span>
              ))}
            </span>
          )}
          {zones && onZoneChange && (
            <ToggleGroup
              variant="control"
              spacing={0}
              value={[zone]}
              onValueChange={([next]) => {
                const picked = zones.find((entry) => entry.zone === next);
                if (picked) {
                  onZoneChange(picked.zone);
                }
              }}
              aria-label={m.decks_workbench_detail_zone_toggle()}
            >
              {zones.map((entry) => (
                <ToggleGroupItem key={entry.zone} value={entry.zone}>
                  {ZONE_LABELS[entry.zone]}
                  <span className="tabular-nums opacity-70">· {entry.count}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {missing > 0 && (
            <span className="text-warning ml-auto text-sm tabular-nums">
              {m.decks_workbench_detail_missing({ count: missing })}
            </span>
          )}
        </div>
      )}
      {otherZones}
    </div>
  );
}

export function DeckRowNote({ uncovered }: { uncovered: UncoveredCopies | undefined }) {
  if (!uncovered) {
    return null;
  }
  const parts = [
    uncovered.excluded > 0 && m.decks_workbench_detail_row_excluded({ count: uncovered.excluded }),
    uncovered.lent > 0 && m.decks_workbench_detail_row_lent({ count: uncovered.lent }),
    uncovered.notOwned > 0 && m.decks_workbench_detail_row_not_owned({ count: uncovered.notOwned }),
  ].filter(Boolean);
  return <span className="text-warning text-xs">{parts.join(" · ")}</span>;
}

export function DeckCardCopies({
  printings,
  homeCollectionId,
}: {
  printings: readonly Printing[];
  homeCollectionId?: string | null;
}) {
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const { data: variants } = useOwnedCollectionsByVariants(
    printings,
    hydrated && Boolean(session?.user),
  );
  const collections = useCollectionsList();
  const countExcluded = useDisplayStore((state) => state.countExcludedCollections);
  const first = variants?.[0];
  if (!variants || !first) {
    return null;
  }

  const siblings = variants.map((variant) => variant.printing);
  const cardName = legendDisplayName(first.printing.card);
  const byCollection = new Map<
    string,
    { name: string; total: number; parts: { printing: Printing; count: number }[] }
  >();
  for (const variant of variants) {
    for (const entry of variant.collections) {
      const row = byCollection.get(entry.collectionId) ?? {
        name: entry.collectionName,
        total: 0,
        parts: [],
      };
      row.total += entry.count;
      row.parts.push({ printing: variant.printing, count: entry.count });
      byCollection.set(entry.collectionId, row);
    }
  }
  const total = [...byCollection.values()].reduce((sum, row) => sum + row.total, 0);
  const excludedIds = new Set(
    countExcluded
      ? []
      : (collections ?? [])
          .filter((col) => !col.availableForDeckbuilding && col.id !== homeCollectionId)
          .map((col) => col.id),
  );

  return (
    <section className="space-y-2">
      <SectionHeading as="h3" count={total}>
        {m.decks_workbench_detail_your_copies()}
      </SectionHeading>
      <ul className="divide-border divide-y">
        {[...byCollection].map(([collectionId, row]) => (
          <li
            key={collectionId}
            className={cn(
              "flex items-center gap-3 py-1.5",
              excludedIds.has(collectionId) && "text-muted-foreground",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                to="/collections/$collectionId"
                params={{ collectionId }}
                search={
                  row.parts.length === 1 && row.parts[0]
                    ? printingCollectionSearch(row.parts[0].printing)
                    : { q: cardName }
                }
                className="truncate hover:underline"
              >
                {row.name}
              </Link>
              {excludedIds.has(collectionId) && (
                <span className="text-muted-foreground text-xs">
                  {m.decks_workbench_detail_copies_excluded()}
                </span>
              )}
              {siblings.length > 1 && (
                <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                  {row.parts.map((part) => (
                    <span key={part.printing.printingId} className="inline-flex gap-1">
                      <PrintingVariantLine printing={part.printing} siblings={siblings} />
                      <span className="tabular-nums">×{part.count}</span>
                    </span>
                  ))}
                </span>
              )}
            </div>
            <span className="font-medium tabular-nums">{row.total}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
