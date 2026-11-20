import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import type { LabelMap } from "@openrift/shared/enum-label";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { EnergyGlyph, PowerPips } from "@/features/decks/components/deck-stat-glyphs";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import type { SideBySideRow, SideBySideZone } from "@/features/decks/lib/deck-side-by-side";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders, useZoneOrder } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";

const CELL_STYLES: Record<SideBySideRow["kind"], { from: string; to: string }> = {
  same: { from: "text-muted-foreground", to: "text-muted-foreground" },
  add: {
    from: "text-muted-foreground/60",
    to: "bg-success-soft text-success",
  },
  cut: { from: "bg-destructive-soft text-destructive", to: "text-muted-foreground/60" },
  change: {
    from: "bg-warning-soft text-warning",
    to: "bg-warning-soft text-warning",
  },
};

/** Both sides share the printing: the catalog's default, not either deck's pinned art. */
interface RowCatalog {
  card?: Card;
  printing?: Printing;
}

/** Everything the rows read from a hook, lifted to the list — see `CardMiniRow`. */
interface RowDisplay {
  domainColors: Record<string, string>;
  rarityLabels: LabelMap;
  domainLabels: LabelMap;
}

function SideCell({
  count,
  row,
  catalog,
  display,
  className,
}: {
  count: number;
  row: SideBySideRow;
  catalog: RowCatalog;
  display: RowDisplay;
  className: string;
}) {
  if (count === 0) {
    return <span className={cn("flex min-h-8 items-center px-2", className)}>—</span>;
  }
  const { card, printing } = catalog;
  return (
    <span
      className={cn("flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 sm:gap-2", className)}
    >
      <CardMiniRow
        className="self-stretch"
        imageId={printing?.images[0]?.imageId}
        landscape={card ? getOrientation(card.types) === "landscape" : false}
        domains={card?.domains}
        domainColors={display.domainColors}
        rarity={printing?.rarity}
        rarityLabels={display.rarityLabels}
        shortCode={printing && distinctPrintingCode(printing)}
        loading="lazy"
        hideMetaOnMobile
      />

      <span className="w-6 shrink-0 text-right tabular-nums">{count}×</span>

      <span className="min-w-0 flex-1 truncate">{row.cardName}</span>

      <PowerPips
        power={card?.power ?? null}
        domains={card?.domains ?? []}
        colors={display.domainColors}
        domainLabels={display.domainLabels}
      />

      {card?.energy !== null && card !== undefined && <EnergyGlyph value={card.energy} />}
    </span>
  );
}

function ChangesRow({
  row,
  catalog,
  display,
  linkCards,
  onHover,
}: {
  row: SideBySideRow;
  catalog: RowCatalog;
  display: RowDisplay;
  linkCards: boolean;
  onHover: (cardId: string | null) => void;
}) {
  const styles = CELL_STYLES[row.kind];
  const className =
    "hover:bg-muted/50 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md text-sm";
  const cells = (
    <>
      <SideCell
        count={row.from}
        row={row}
        catalog={catalog}
        display={display}
        className={styles.from}
      />
      <ArrowRightIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0",
          row.kind === "same" ? "text-muted-foreground/30" : "text-muted-foreground",
        )}
      />
      <SideCell
        count={row.to}
        row={row}
        catalog={catalog}
        display={display}
        className={styles.to}
      />
    </>
  );
  if (!catalog.card) {
    return <div className={className}>{cells}</div>;
  }
  if (!linkCards) {
    return (
      <div
        className={className}
        onMouseEnter={() => onHover(row.cardId)}
        onMouseLeave={() => onHover(null)}
      >
        {cells}
      </div>
    );
  }
  return (
    <Link
      to="/cards/$cardSlug/{-$printingSlug}"
      params={{ cardSlug: catalog.card.slug }}
      className={className}
      onMouseEnter={() => onHover(row.cardId)}
      onMouseLeave={() => onHover(null)}
    >
      {cells}
    </Link>
  );
}

export function DeckChangesList({
  zones,
  changesOnly,
  linkCards = true,
  onHover,
}: {
  zones: readonly SideBySideZone[];
  changesOnly: boolean;
  linkCards?: boolean;
  onHover: (cardId: string | null) => void;
}) {
  const { zoneLabels } = useZoneOrder();
  const { cardsById } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const { labels } = useEnumOrders();
  const domainColors = useDomainColors();

  const display: RowDisplay = {
    domainColors,
    rarityLabels: labels.rarities,
    domainLabels: labels.domains,
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {zones.map((zone) => {
        const zoneRows = changesOnly ? zone.rows.filter((row) => row.kind !== "same") : zone.rows;
        if (zoneRows.length === 0) {
          return null;
        }
        return (
          <section key={zone.zone} className="flex min-w-0 flex-col gap-1">
            <DeckZoneHeader label={enumLabel(zoneLabels, zone.zone)} />
            {zoneRows.map((row) => (
              <ChangesRow
                key={`${zone.zone}-${row.cardId}`}
                row={row}
                catalog={{
                  card: cardsById[row.cardId],
                  printing: getPreferredPrinting(row.cardId),
                }}
                display={display}
                linkCards={linkCards}
                onHover={onHover}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
