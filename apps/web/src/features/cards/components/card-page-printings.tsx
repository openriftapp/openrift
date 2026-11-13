import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Heading } from "@/components/heading";
import { LanguageChip } from "@/components/language-chip";
import { Pressable } from "@/components/ui/pressable";
import { PrintingArt } from "@/features/cards/components/card-detail/printing-art";
import {
  OwnedPill,
  WithPrintingStats,
} from "@/features/cards/components/card-detail/printing-stats";
import type { CellStats } from "@/features/cards/components/card-detail/printing-stats";
import { PrintingDesignRows } from "@/features/cards/components/printing-design-rows";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { groupPrintingDesigns, isSelectedSide } from "@/features/cards/lib/printing-designs";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { useLanguageLabels } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface MatrixProps {
  languages: string[];
  designs: PrintingDesign[];
  selectedSideKey?: string;
  onSelect: (printing: Printing) => void;
  highlightSideKey?: string | null;
  onHighlightEnd?: () => void;
  showImages?: boolean;
  stickyHeader?: boolean;
  onLanguageSelect?: (language: string) => void;
  onDesignSelect?: (designKey: string) => void;
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
  const isMobile = useIsMobile();
  const pickedSideKey = usePrintingLightboxStore((state) => state.pickedSideKey);
  const clearPicked = usePrintingLightboxStore((state) => state.clearPicked);
  if (printings.length === 0) {
    return null;
  }
  const props: MatrixProps = {
    ...groupPrintingDesigns(printings),
    onSelect: (printing: Printing) => {
      onSelect(printing);
      if (!isMobile) {
        globalThis.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    highlightSideKey: pickedSideKey,
    onHighlightEnd: clearPicked,
    showImages: true,
  };
  return (
    <section className="@container flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Heading level={2}>{m.cards_page_printings_heading()}</Heading>
        {headerAction && <div className="md:hidden">{headerAction}</div>}
      </div>
      <WithPrintingStats printingIds={designPrintingIds(props.designs)}>
        {(stats) => <PrintingTable {...props} selectedSideKey={selectedSideKey} stats={stats} />}
      </WithPrintingStats>
    </section>
  );
}

/** `printings` must be in language-preference order. */
export function PrintingLanguageMatrix({
  printings,
  ...rest
}: Omit<MatrixProps, "languages" | "designs" | "highlightSideKey" | "onHighlightEnd"> & {
  printings: Printing[];
}) {
  const props: MatrixProps = { ...groupPrintingDesigns(printings), ...rest };
  return (
    <WithPrintingStats printingIds={designPrintingIds(props.designs)}>
      {(stats) => <PrintingMatrix {...props} stats={stats} />}
    </WithPrintingStats>
  );
}

function PrintingTable(props: MatrixProps & { selectedSideKey: string; stats?: CellStats }) {
  const { designs, selectedSideKey, onSelect, highlightSideKey, onHighlightEnd, stats } = props;
  return (
    <>
      <div className="hidden md:block">
        <PrintingMatrix {...props} />
      </div>
      <div className="bg-card rounded-xl border px-3 py-2 md:hidden">
        <PrintingDesignRows
          designs={designs}
          selectedSideKey={selectedSideKey}
          highlightSideKey={highlightSideKey}
          onHighlightEnd={onHighlightEnd}
          onSelect={onSelect}
          badge={stats && ((printing) => <OwnedPill count={stats.owned?.[printing.printingId]} />)}
          right={
            stats &&
            ((printing) => (
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {stats.price(printing.printingId)}
              </span>
            ))
          }
          details={(design) => <DesignDetails design={design} />}
        />
      </div>
    </>
  );
}

const CELL_GRID =
  "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-3 sm:w-[min(calc(var(--cols)*36rem),calc(100cqw-20rem),calc(var(--cols)*(100dvh-12rem)*var(--aspect-card)))] sm:shrink-0";

function PrintingMatrix({
  languages,
  designs,
  selectedSideKey,
  onSelect,
  highlightSideKey,
  onHighlightEnd,
  showImages,
  stickyHeader,
  onLanguageSelect,
  onDesignSelect,
  stats,
}: MatrixProps & { stats?: CellStats }) {
  const languageLabels = useLanguageLabels();
  const leads = designs.map((design) => design.lead);
  const columns = { "--cols": languages.length } as CSSProperties;
  const cellSizes = `(min-width: 640px) calc((100vw - 20rem) / ${languages.length}), calc((100vw - 2rem) / ${languages.length})`;

  return (
    // overflow-hidden would disable the sticky header, so the header rounds its own corners.
    <div
      className={cn("bg-card rounded-xl border", !stickyHeader && "overflow-hidden")}
      style={columns}
    >
      <div
        className={cn(
          "flex px-3 py-2 sm:px-4",
          stickyHeader && "bg-card sticky top-0 z-20 rounded-t-xl",
        )}
      >
        <span className="hidden flex-1 sm:block" />
        <div className={cn(CELL_GRID, "flex-1 sm:flex-none")}>
          {languages.map((language) => (
            <span key={language} className="flex justify-center">
              {onLanguageSelect ? (
                <Pressable
                  aria-label={enumLabel(languageLabels, language)}
                  onClick={() => onLanguageSelect(language)}
                  className="rounded-full"
                >
                  <LanguageChip code={language} />
                </Pressable>
              ) : (
                <LanguageChip code={language} />
              )}
            </span>
          ))}
        </div>
      </div>
      <ul>
        {designs.map((design) => (
          <li
            key={design.key}
            className="flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2"
          >
            {onDesignSelect ? (
              <Pressable
                onClick={() => onDesignSelect(design.key)}
                className="flex min-w-0 flex-1 rounded-md text-left"
              >
                <DesignInfo design={design} leads={leads} />
              </Pressable>
            ) : (
              <DesignInfo design={design} leads={leads} />
            )}
            <div className={CELL_GRID}>
              {languages.map((language) => {
                const printing = design.byLanguage.get(language);
                if (!printing) {
                  return (
                    <span
                      key={language}
                      className="flex w-full flex-col items-center gap-1 px-1 py-1"
                    >
                      <span
                        aria-hidden
                        className="aspect-card w-full border border-dashed"
                        style={{ borderRadius: CARD_BORDER_RADIUS }}
                      />
                      {stats && (
                        <span className="text-muted-foreground/60 text-sm font-semibold tabular-nums">
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
                    selected={
                      selectedSideKey === undefined
                        ? undefined
                        : isSelectedSide(printing, selectedSideKey)
                    }
                    highlighted={
                      highlightSideKey !== undefined &&
                      highlightSideKey !== null &&
                      isSelectedSide(printing, highlightSideKey)
                    }
                    onHighlightEnd={onHighlightEnd}
                    onSelect={() => onSelect(printing)}
                    showImages={showImages}
                    sizes={cellSizes}
                    stats={stats}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrintingCell({
  printing,
  languageLabel,
  selected,
  highlighted,
  onHighlightEnd,
  onSelect,
  showImages,
  sizes,
  stats,
}: {
  printing: Printing;
  languageLabel: string;
  selected?: boolean;
  highlighted: boolean;
  onHighlightEnd?: () => void;
  onSelect: () => void;
  showImages?: boolean;
  sizes: string;
  stats?: CellStats;
}) {
  const cellRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (highlighted) {
      cellRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="w-full">
        <PrintingArt
          printing={printing}
          showImages={showImages}
          sizes={sizes}
          compactFlip
          frame={(art) => (
            <Pressable
              ref={cellRef}
              onClick={onSelect}
              data-printing-id={printing.printingId}
              data-highlighted={highlighted || undefined}
              data-lightbox-tile=""
              aria-pressed={selected}
              aria-label={`${distinctPrintingCode(printing)}, ${languageLabel}`}
              onAnimationEnd={(event) => {
                if (highlighted && event.target === event.currentTarget) {
                  onHighlightEnd?.();
                }
              }}
              className={cn(
                "block w-full rounded-md px-1 py-1 transition-colors",
                selected ? "bg-primary/10" : "hover:bg-muted/50",
                highlighted && "animate-printing-picked",
              )}
            >
              <span
                className={cn(
                  "relative block w-full rounded-[5%/3.6%]",
                  selected && "ring-primary ring-offset-card ring-2 ring-offset-2",
                )}
              >
                {art}
                <OwnedPill floating count={stats?.owned?.[printing.printingId]} />
              </span>
            </Pressable>
          )}
        />
      </div>
      {stats && (
        <span className="text-sm font-semibold tabular-nums">
          {stats.price(printing.printingId)}
        </span>
      )}
    </div>
  );
}

function DesignInfo({ design, leads }: { design: PrintingDesign; leads: Printing[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="min-w-0 text-xs">
        <PrintingVariantLine printing={design.lead} siblings={leads} hideLanguage />
      </span>
      <DesignDetails design={design} />
      {design.lead.otherSide && design.lead.otherSide.cardId !== design.lead.cardId && (
        <span className="text-muted-foreground text-xs">
          {m.card_detail_lightbox_back({ name: design.lead.otherSide.cardName })}
        </span>
      )}
    </div>
  );
}

function designPrintingIds(designs: PrintingDesign[]): string[] {
  return designs.flatMap((design) =>
    [...design.byLanguage.values()].map((printing) => printing.printingId),
  );
}

export function DesignDetails({ design }: { design: PrintingDesign }) {
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
