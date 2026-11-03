import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { Printing } from "@openrift/shared/types/catalog";
import type { CSSProperties, ReactNode } from "react";
import { Suspense, useEffect, useRef } from "react";

import { Heading } from "@/components/heading";
import { LanguageChip } from "@/components/language-chip";
import { Pressable } from "@/components/ui/pressable";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { CardDetailArt } from "@/features/cards/components/card-detail/card-detail-art";
import { PrintingDesignRows } from "@/features/cards/components/printing-design-rows";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { groupPrintingDesigns, isSelectedSide } from "@/features/cards/lib/printing-designs";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useLanguageLabels } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/hooks/use-session";
import { formatPrice, formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface MatrixProps {
  languages: string[];
  designs: PrintingDesign[];
  selectedSideKey?: string;
  onSelect: (printing: Printing) => void;
  highlightSideKey?: string | null;
  onHighlightEnd?: () => void;
  large?: boolean;
  showImages?: boolean;
}

interface CellStats {
  owned?: Record<string, number>;
  price: (printingId: string) => ReactNode;
}

export function CardPagePrintings({
  printings,
  selectedSideKey,
  onSelect,
  headerAction,
}: {
  printings: Printing[];
  selectedSideKey: string;
  onSelect: (printing: Printing) => void;
  headerAction?: ReactNode;
}) {
  const hydrated = useHydrated();
  const pickedSideKey = usePrintingLightboxStore((state) => state.pickedSideKey);
  const clearPicked = usePrintingLightboxStore((state) => state.clearPicked);
  if (printings.length === 0) {
    return null;
  }
  const props = {
    ...groupPrintingDesigns(printings),
    selectedSideKey,
    onSelect,
    highlightSideKey: pickedSideKey,
    onHighlightEnd: clearPicked,
  };
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Heading level={2}>{m.cards_page_printings_heading()}</Heading>
        {headerAction}
      </div>
      {/* Prices and owned counts have no server snapshot, so they join after hydration. */}
      {hydrated ? (
        <Suspense fallback={<PrintingTable {...props} />}>
          <LiveStats designs={props.designs}>
            {(stats) => <PrintingTable {...props} stats={stats} />}
          </LiveStats>
        </Suspense>
      ) : (
        <PrintingTable {...props} />
      )}
    </section>
  );
}

/** `printings` must be in language-preference order. */
export function PrintingLanguageMatrix({
  printings,
  onSelect,
  showImages,
}: {
  printings: Printing[];
  onSelect: (printing: Printing) => void;
  showImages?: boolean;
}) {
  const props: MatrixProps = {
    ...groupPrintingDesigns(printings),
    onSelect,
    large: true,
    showImages,
  };
  return (
    <Suspense fallback={<PrintingMatrix {...props} />}>
      <LiveStats designs={props.designs}>
        {(stats) => <PrintingMatrix {...props} stats={stats} />}
      </LiveStats>
    </Suspense>
  );
}

function LiveStats({
  designs,
  children,
}: {
  designs: PrintingDesign[];
  children: (stats: CellStats) => ReactNode;
}) {
  const userId = useUserId();
  const prices = usePrices();
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const printingIds = designs.flatMap((design) =>
    [...design.byLanguage.values()].map((printing) => printing.printingId),
  );
  const { data: owned } = useOwnedCountsForPrintings(printingIds, Boolean(userId));

  const price = (printingId: string) => {
    const marketplace = marketplaceOrder.find(
      (candidate) => prices.get(printingId, candidate) !== undefined,
    );
    const value = marketplace === undefined ? undefined : prices.get(printingId, marketplace);
    if (marketplace === undefined || value === undefined) {
      return <span className="text-muted-foreground/60">{formatPrice()}</span>;
    }
    return (
      <span className={priceColorClass(value)} title={marketplaceLabel(marketplace)}>
        {formatterForMarketplace(marketplace)(value)}
      </span>
    );
  };

  return children({ owned: owned?.totals, price });
}

function PrintingTable(props: MatrixProps & { selectedSideKey: string; stats?: CellStats }) {
  const { designs, selectedSideKey, onSelect, highlightSideKey, onHighlightEnd, stats } = props;
  return (
    <>
      <div className="hidden sm:block">
        <PrintingMatrix {...props} />
      </div>
      <div className="bg-card rounded-xl border px-3 py-2 sm:hidden">
        <PrintingDesignRows
          designs={designs}
          selectedSideKey={selectedSideKey}
          highlightSideKey={highlightSideKey}
          onHighlightEnd={onHighlightEnd}
          onSelect={onSelect}
          badge={stats && ((printing) => <OwnedBadge count={stats.owned?.[printing.printingId]} />)}
          right={stats && ((printing) => <CompactPrice printing={printing} stats={stats} />)}
          details={(design) => <DesignDetails design={design} />}
        />
      </div>
    </>
  );
}

function OwnedBadge({ count = 0 }: { count?: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <span className="bg-foreground text-background ring-card text-2xs flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-bold tabular-nums ring-2">
      ×{count}
    </span>
  );
}

function CompactPrice({ printing, stats }: { printing: Printing; stats: CellStats }) {
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums">
      {stats.price(printing.printingId)}
    </span>
  );
}

function PrintingMatrix({
  languages,
  designs,
  selectedSideKey,
  onSelect,
  highlightSideKey,
  onHighlightEnd,
  large,
  showImages,
  stats,
}: MatrixProps & { stats?: CellStats }) {
  const languageLabels = useLanguageLabels();
  const leads = designs.map((design) => design.lead);
  const columns = { "--cols": languages.length } as CSSProperties;
  const cellGrid = cn(
    "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))]",
    large
      ? "gap-3 sm:w-[min(calc(var(--cols)*18rem),calc(100vw-22rem))] sm:shrink-0"
      : "gap-2 sm:grid-cols-[repeat(var(--cols),4.5rem)]",
  );

  return (
    <div className="bg-card overflow-hidden rounded-xl border" style={columns}>
      <div className="flex px-3 py-2 sm:px-4">
        <span className="hidden flex-1 sm:block" />
        <div className={cn(cellGrid, "flex-1 sm:flex-none")}>
          {languages.map((language) => (
            <span key={language} className="flex justify-center">
              <LanguageChip code={language} />
            </span>
          ))}
        </div>
      </div>
      <ul>
        {designs.map((design) => {
          const hasSelected =
            selectedSideKey !== undefined &&
            [...design.byLanguage.values()].some((printing) =>
              isSelectedSide(printing, selectedSideKey),
            );
          return (
            <li
              key={design.key}
              className={cn(
                "flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2",
                hasSelected && "bg-primary/5",
              )}
            >
              <DesignInfo design={design} leads={leads} />
              <div className={cellGrid}>
                {languages.map((language) => {
                  const printing = design.byLanguage.get(language);
                  if (!printing) {
                    return (
                      <span
                        key={language}
                        className={cn("flex flex-col items-center gap-1 py-1", large && "w-full")}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "aspect-card border border-dashed",
                            large ? "w-full" : "w-11",
                          )}
                          style={{ borderRadius: CARD_BORDER_RADIUS }}
                        />
                        {stats && (
                          <span
                            className={cn(
                              "text-muted-foreground/60 font-semibold tabular-nums",
                              large ? "text-sm" : "text-xs",
                            )}
                          >
                            {formatPrice()}
                          </span>
                        )}
                      </span>
                    );
                  }
                  return (
                    <PrintingCell
                      key={language}
                      printing={printing}
                      languageLabel={enumLabel(languageLabels, language)}
                      isSelected={
                        selectedSideKey !== undefined && isSelectedSide(printing, selectedSideKey)
                      }
                      highlighted={
                        highlightSideKey !== undefined &&
                        highlightSideKey !== null &&
                        isSelectedSide(printing, highlightSideKey)
                      }
                      onHighlightEnd={onHighlightEnd}
                      onSelect={() => onSelect(printing)}
                      large={large}
                      showImages={showImages}
                      stats={stats}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PrintingCell({
  printing,
  languageLabel,
  isSelected,
  highlighted,
  onHighlightEnd,
  onSelect,
  large,
  showImages,
  stats,
}: {
  printing: Printing;
  languageLabel: string;
  isSelected: boolean;
  highlighted: boolean;
  onHighlightEnd?: () => void;
  onSelect: () => void;
  large?: boolean;
  showImages?: boolean;
  stats?: CellStats;
}) {
  const cellRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (highlighted) {
      cellRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);
  const owned = stats?.owned?.[printing.printingId] ?? 0;
  return (
    <Pressable
      ref={cellRef}
      onClick={onSelect}
      aria-pressed={isSelected}
      data-printing-id={printing.printingId}
      data-highlighted={highlighted || undefined}
      aria-label={large ? `${distinctPrintingCode(printing)}, ${languageLabel}` : undefined}
      onAnimationEnd={(event) => {
        if (highlighted && event.target === event.currentTarget) {
          onHighlightEnd?.();
        }
      }}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md py-1 transition-colors",
        large && "w-full px-1",
        isSelected ? "bg-primary/10" : "hover:bg-muted/50",
        highlighted && "animate-printing-picked",
      )}
    >
      <span
        className={cn(
          "relative",
          large && [
            "block w-full rounded-[5%/3.6%]",
            isSelected && "ring-primary ring-offset-card ring-2 ring-offset-2",
          ],
        )}
      >
        {large ? (
          <CardDetailArt printing={printing} showImages={showImages} disableTilt sizes="18rem" />
        ) : (
          <CardArtThumb
            imageId={printing.images[0]?.imageId}
            alt={`${distinctPrintingCode(printing)}, ${languageLabel}`}
            landscape={getOrientation(printing.card.types) === "landscape"}
            rarity={printing.rarity}
            domains={printing.card.domains}
            className={cn(
              "w-11",
              isSelected && "ring-primary ring-offset-card ring-2 ring-offset-2",
            )}
            loading="lazy"
          />
        )}
        {owned > 0 && (
          <span className="bg-foreground text-background ring-card text-2xs absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-semibold ring-2">
            ×{owned}
          </span>
        )}
      </span>
      {stats && (
        <span className={cn("font-semibold tabular-nums", large ? "text-sm" : "text-xs")}>
          {stats.price(printing.printingId)}
        </span>
      )}
    </Pressable>
  );
}

function DesignInfo({ design, leads }: { design: PrintingDesign; leads: Printing[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="min-w-0 text-xs">
        <PrintingVariantLine printing={design.lead} siblings={leads} hideLanguage />
      </span>
      <DesignDetails design={design} />
    </div>
  );
}

function DesignDetails({ design }: { design: PrintingDesign }) {
  const channelLabels = [...design.byLanguage.values()].flatMap((member) =>
    member.distributionChannels.map((link) =>
      link.ancestorLabels.length > 0
        ? `${link.ancestorLabels.join(" › ")} › ${link.channel.label}`
        : link.channel.label,
    ),
  );
  const channelSummary = [...new Set(channelLabels)].join(", ");

  return channelSummary ? (
    <p className="text-muted-foreground truncate text-xs">{channelSummary}</p>
  ) : null;
}
