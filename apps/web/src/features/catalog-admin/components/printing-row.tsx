import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { PrintingDetails } from "@/features/catalog-admin/components/printing-details";
import { PrintingImages } from "@/features/catalog-admin/components/printing-images";
import { PrintingLinks } from "@/features/catalog-admin/components/printing-links";
import { PrintingThumbnail } from "@/features/catalog-admin/components/printing-thumbnail";
import { displayPrintingImage } from "@/features/catalog-admin/lib/printing-images";
import type { PrintingKindLabels } from "@/features/catalog-admin/lib/printing-summary";
import {
  printingKindLabel,
  printingSetLine,
  soldOnSummary,
} from "@/features/catalog-admin/lib/printing-summary";

function imageBadge(printing: AdminPrintingResponse, hasImage: boolean) {
  if (hasImage) {
    return <Badge variant="success">image</Badge>;
  }
  if (printing.fallbackArtMode === "pinned") {
    return <Badge variant="warning">substitute</Badge>;
  }
  return <Badge variant="destructive">none</Badge>;
}

export function PrintingRow({
  printing,
  detail,
  cardSlug,
  labels,
  isAdmin,
  expanded,
  onToggle,
}: {
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  cardSlug: string;
  labels: PrintingKindLabels & {
    rarities: Record<string, string>;
    finishes: Record<string, string>;
  };
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const image = displayPrintingImage(printing.id, detail.printingImages);

  return (
    <li className="border-b last:border-b-0">
      <ExpandToggle
        expanded={expanded}
        chevronPosition="end"
        onClick={onToggle}
        className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-md px-2 py-2"
      >
        <PrintingThumbnail image={image} alt={printing.expectedPrintingId} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <PrintingIdLabel
              label={printing.expectedPrintingId}
              language={printing.language}
              className="font-medium"
            />
            <span className="text-sm">{printingKindLabel(printing, labels)}</span>
            {imageBadge(printing, image !== undefined)}
          </span>
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span>{printingSetLine(printing, labels)}</span>
            <span aria-hidden>·</span>
            <span>{soldOnSummary(printing.id, detail.marketplaceMappings)}</span>
          </span>
        </span>
      </ExpandToggle>

      {expanded && (
        <Suspense fallback={<Skeleton className="mx-2 my-3 h-64" />}>
          <div className="space-y-6 px-2 pt-2 pb-4">
            <PrintingDetails printing={printing} cardSlug={cardSlug} isAdmin={isAdmin} />
            <PrintingImages printing={printing} detail={detail} isAdmin={isAdmin} />
            {isAdmin && <PrintingLinks printingId={printing.id} />}
          </div>
        </Suspense>
      )}
    </li>
  );
}
