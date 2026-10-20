import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { PaletteIcon, TagIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";

import { CardIcon } from "@/components/card-icon";
import { Heading } from "@/components/heading";
import { LanguageChip } from "@/components/language-chip";
import { Pressable } from "@/components/ui/pressable";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { FinishIcon, hasFinishIcon } from "@/features/cards/components/finish-icon";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { groupPrintingDesigns } from "@/features/cards/lib/printing-designs";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/hooks/use-session";
import { formatPrice, formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface MatrixProps {
  languages: string[];
  designs: PrintingDesign[];
  selectedSideKey: string;
  onSelect: (printing: Printing) => void;
}

interface CellStats {
  owned?: Record<string, number>;
  price: (printingId: string) => ReactNode;
}

export function CardPagePrintings({
  printings,
  selectedSideKey,
  onSelect,
}: {
  printings: Printing[];
  selectedSideKey: string;
  onSelect: (printing: Printing) => void;
}) {
  const hydrated = useHydrated();
  if (printings.length === 0) {
    return null;
  }
  const props: MatrixProps = {
    ...groupPrintingDesigns(printings),
    selectedSideKey,
    onSelect,
  };
  return (
    <section className="flex flex-col gap-4">
      <Heading level={2}>{m.cards_page_printings_heading()}</Heading>
      {/* Prices and owned counts have no server snapshot, so they join after hydration. */}
      {hydrated ? (
        <Suspense fallback={<PrintingMatrix {...props} />}>
          <LivePrintingMatrix {...props} />
        </Suspense>
      ) : (
        <PrintingMatrix {...props} />
      )}
    </section>
  );
}

function LivePrintingMatrix(props: MatrixProps) {
  const userId = useUserId();
  const prices = usePrices();
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const printingIds = props.designs.flatMap((design) =>
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

  return <PrintingMatrix {...props} stats={{ owned: owned?.totals, price }} />;
}

function PrintingMatrix({
  languages,
  designs,
  selectedSideKey,
  onSelect,
  stats,
}: MatrixProps & { stats?: CellStats }) {
  const languageLabels = useLanguageLabels();
  const columns = { "--cols": languages.length } as CSSProperties;
  const cellGrid =
    "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(var(--cols),4.5rem)]";

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
          const hasSelected = [...design.byLanguage.values()].some(
            (printing) => sideKey(printing) === selectedSideKey,
          );
          return (
            <li
              key={design.key}
              className={cn(
                "flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2",
                hasSelected && "bg-primary/5",
              )}
            >
              <DesignInfo design={design} />
              <div className={cellGrid}>
                {languages.map((language) => {
                  const printing = design.byLanguage.get(language);
                  if (!printing) {
                    return (
                      <span key={language} className="flex justify-center py-1">
                        <span
                          aria-hidden
                          className="aspect-card w-11 border border-dashed"
                          style={{ borderRadius: CARD_BORDER_RADIUS }}
                        />
                      </span>
                    );
                  }
                  return (
                    <PrintingCell
                      key={language}
                      printing={printing}
                      languageLabel={enumLabel(languageLabels, language)}
                      isSelected={sideKey(printing) === selectedSideKey}
                      onSelect={() => onSelect(printing)}
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
  onSelect,
  stats,
}: {
  printing: Printing;
  languageLabel: string;
  isSelected: boolean;
  onSelect: () => void;
  stats?: CellStats;
}) {
  const owned = stats?.owned?.[printing.printingId] ?? 0;
  const dimmed = stats?.owned !== undefined && owned === 0 && !isSelected;
  return (
    <Pressable
      onClick={onSelect}
      aria-pressed={isSelected}
      data-printing-id={printing.printingId}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md py-1 transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted/50",
      )}
    >
      <span className="relative">
        <CardArtThumb
          imageId={printing.images[0]?.imageId}
          alt={`${printing.publicCode}, ${languageLabel}`}
          landscape={getOrientation(printing.card.types) === "landscape"}
          rarity={printing.rarity}
          domains={printing.card.domains}
          className={cn(
            "w-11",
            isSelected && "ring-primary ring-offset-card ring-2 ring-offset-2",
            dimmed && "opacity-60",
          )}
          loading="lazy"
        />
        {owned > 0 && (
          <span className="bg-foreground text-background ring-card text-2xs absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-semibold ring-2">
            ×{owned}
          </span>
        )}
      </span>
      {stats && (
        <span className="text-xs font-semibold tabular-nums">
          {stats.price(printing.printingId)}
        </span>
      )}
    </Pressable>
  );
}

function DesignInfo({ design }: { design: PrintingDesign }) {
  const printing = design.lead;
  const showArtVariant = printing.artVariant !== WellKnown.artVariant.NORMAL;
  const { labels } = useEnumOrders();

  const badges: ReactNode[] = [];
  if (hasFinishIcon(printing.finish)) {
    badges.push(
      <span key="finish" className="inline-flex items-center gap-0.5 text-xs">
        <FinishIcon finish={printing.finish} iconClassName="size-3" />
        {enumLabel(labels.finishes, printing.finish)}
      </span>,
    );
  }
  if (showArtVariant) {
    badges.push(
      <span key="art" className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
        <PaletteIcon className="size-3" />
        {enumLabel(labels.artVariants, printing.artVariant)}
      </span>,
    );
  }
  if (printing.markers.length > 0) {
    badges.push(
      <span
        key="markers"
        className="text-muted-foreground inline-flex items-center gap-0.5 text-xs"
      >
        <TagIcon className="size-3" />
        {printing.markers.map((marker) => marker.label).join(", ")}
      </span>,
    );
  }
  if (printing.otherSide) {
    badges.push(
      <span key="double-sided" className="text-muted-foreground text-xs">
        {m.cards_printing_double_sided({ name: printing.otherSide.cardName })}
      </span>,
    );
  }
  if (printing.isOvernumbered) {
    badges.push(
      <span key="overnumbered" className="text-muted-foreground text-xs">
        {m.cards_flag_overnumbered()}
      </span>,
    );
  }
  if (printing.isSigned) {
    badges.push(
      <span key="signed" className="text-muted-foreground text-xs">
        {m.cards_flag_signed()}
      </span>,
    );
  }

  const channelLabels = [...design.byLanguage.values()].flatMap((member) =>
    member.distributionChannels.map((link) =>
      link.ancestorLabels.length > 0
        ? `${link.ancestorLabels.join(" › ")} › ${link.channel.label}`
        : link.channel.label,
    ),
  );
  const channelSummary = [...new Set(channelLabels)].join(", ");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold">{printing.shortCode}</p>
        {badges}
      </div>
      {printing.artist && (
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <CardIcon src="/images/artist.svg" className="size-3 shrink-0" />
          <span className="truncate">{printing.artist}</span>
        </p>
      )}
      {channelSummary && <p className="text-muted-foreground truncate text-xs">{channelSummary}</p>}
    </div>
  );
}
