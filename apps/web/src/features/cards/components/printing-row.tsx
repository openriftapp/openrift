import { toVariantSiblingSummary } from "@openrift/shared/printing-label";
import type { VariantSiblingSummary } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";
import { use } from "react";

import { PrintingVariantLabel } from "@/features/cards/components/printing-label";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useCards } from "@/features/cards/hooks/use-cards";
import { VariantSiblingsContext } from "@/features/cards/lib/variant-siblings-context";
import { formatCardId } from "@/lib/format";

export function PrintingVariantLine({
  printing,
  siblings,
  hideLanguage,
  publicCode,
  className,
}: {
  printing: Printing;
  siblings?: readonly Printing[] | VariantSiblingSummary;
  hideLanguage?: boolean;
  publicCode?: boolean;
  className?: string;
}) {
  const summary = toVariantSiblingSummary(siblings);
  const hasMixedRarities = summary ? summary.rarities.length > 1 : false;
  const code = publicCode ? printing.publicCode : formatCardId(printing);

  return (
    <PrintingVariantLabel
      printing={printing}
      siblings={summary}
      hideLanguage={hideLanguage}
      className={className}
      code={
        <span className="inline-flex items-baseline gap-1">
          {hasMixedRarities && (
            <RarityIcon rarity={printing.rarity} labelled className="size-3.5 self-center" />
          )}
          <span className="text-muted-foreground font-mono text-xs">{code}</span>
        </span>
      }
    />
  );
}

export function CatalogPrintingVariantLine({
  printing,
  hideLanguage,
  publicCode,
  className,
}: {
  printing: Printing;
  hideLanguage?: boolean;
  publicCode?: boolean;
  className?: string;
}) {
  const summary = use(VariantSiblingsContext)?.[printing.cardId];
  if (summary) {
    return (
      <PrintingVariantLine
        printing={printing}
        siblings={summary}
        hideLanguage={hideLanguage}
        publicCode={publicCode}
        className={className}
      />
    );
  }
  return (
    <CatalogSiblingsVariantLine
      printing={printing}
      hideLanguage={hideLanguage}
      publicCode={publicCode}
      className={className}
    />
  );
}

function CatalogSiblingsVariantLine({
  printing,
  hideLanguage,
  publicCode,
  className,
}: {
  printing: Printing;
  hideLanguage?: boolean;
  publicCode?: boolean;
  className?: string;
}) {
  const { printingsByCardId } = useCards();
  return (
    <PrintingVariantLine
      printing={printing}
      siblings={printingsByCardId.get(printing.cardId)}
      hideLanguage={hideLanguage}
      publicCode={publicCode}
      className={className}
    />
  );
}

export function PrintingRowContent({
  printing,
  siblings,
  name,
  right,
  thumbClassName,
  thumbBadge,
}: {
  printing: Printing;
  siblings?: readonly Printing[];
  name?: string;
  right?: ReactNode;
  thumbClassName?: string;
  thumbBadge?: ReactNode;
}) {
  const thumb = (
    <PrintingThumbnail printing={printing} className={thumbClassName ?? (name ? "h-10" : "h-8")} />
  );
  return (
    // A span, not a div: the scan sheets nest this inside a Pressable, and a
    // flow element inside a button is invalid markup.
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {thumbBadge ? (
        <span className="relative mr-1 shrink-0">
          {thumb}
          <span className="absolute -top-1.5 -right-2">{thumbBadge}</span>
        </span>
      ) : (
        thumb
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {name ? <span className="truncate font-medium">{name}</span> : null}
        <span className="min-w-0 truncate text-xs">
          <PrintingVariantLine printing={printing} siblings={siblings} />
        </span>
      </span>
      {right}
    </span>
  );
}
