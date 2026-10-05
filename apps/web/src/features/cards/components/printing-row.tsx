import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { PrintingVariantLabel } from "@/features/cards/components/printing-label";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { formatCardId } from "@/lib/format";

export function PrintingVariantLine({
  printing,
  siblings,
  className,
}: {
  printing: Printing;
  siblings?: readonly Printing[];
  className?: string;
}) {
  const hasMixedRarities = siblings ? new Set(siblings.map((p) => p.rarity)).size > 1 : false;
  const code = formatCardId(printing);

  return (
    <PrintingVariantLabel
      printing={printing}
      siblings={siblings}
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

export function PrintingRowContent({
  printing,
  siblings,
  name,
  right,
  thumbClassName,
}: {
  printing: Printing;
  siblings?: readonly Printing[];
  name?: string;
  right?: ReactNode;
  thumbClassName?: string;
}) {
  return (
    // A span, not a div: the scan sheets nest this inside a Pressable, and a
    // flow element inside a button is invalid markup.
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <PrintingThumbnail
        printing={printing}
        className={thumbClassName ?? (name ? "h-10" : "h-8")}
      />
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
