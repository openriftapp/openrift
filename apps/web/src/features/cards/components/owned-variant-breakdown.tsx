import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";

import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { printingCollectionSearch } from "@/features/cards/lib/printing-search-link";
import type { VariantCollectionBreakdownEntry } from "@/features/collections/hooks/use-owned-count";
import { cn } from "@/lib/utils";

export function OwnedVariantBreakdown({
  variants,
}: {
  variants: readonly VariantCollectionBreakdownEntry<Printing>[];
}) {
  const siblings = variants.map((variant) => variant.printing);
  return (
    <div className="px-1 pb-1">
      {variants.map((variant) => (
        <div key={variant.printingId} className="px-1 pb-1 last:pb-0">
          <h3 className="px-2 pt-1.5 pb-0.5 text-xs">
            <PrintingVariantLine printing={variant.printing} siblings={siblings} />
          </h3>
          <ul>
            {variant.collections.map((entry) => (
              <li key={entry.collectionId}>
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: entry.collectionId }}
                  search={printingCollectionSearch(variant.printing)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1 text-sm",
                    "hover:bg-muted transition-colors",
                  )}
                >
                  <span className="truncate">{entry.collectionName}</span>
                  <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">
                    &times;{entry.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
