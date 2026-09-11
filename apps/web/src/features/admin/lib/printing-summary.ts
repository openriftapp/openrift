import { enumLabel } from "@openrift/shared/enum-label";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";

interface PrintingKindLabels {
  artVariants: Record<string, string>;
  markers: Record<string, string>;
}

type KindPrinting = Pick<
  AdminPrintingResponse,
  "isSigned" | "isOvernumbered" | "markerSlugs" | "artVariant"
>;

export function printingKindLabel(printing: KindPrinting, labels: PrintingKindLabels): string {
  const parts: string[] = [];
  if (printing.isSigned && printing.isOvernumbered) {
    parts.push("Signature");
  } else if (printing.isSigned) {
    parts.push("Signed");
  } else if (printing.isOvernumbered) {
    parts.push("Overnumbered");
  }
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    parts.push(enumLabel(labels.artVariants, printing.artVariant));
  }
  for (const slug of printing.markerSlugs) {
    parts.push(enumLabel(labels.markers, slug));
  }
  return parts.length > 0 ? parts.join(" · ") : "Base";
}

function printingCodeLabel(printing: AdminPrintingResponse): string {
  return `${printing.shortCode} · ${printing.language.toUpperCase()}`;
}

export function printingBlockTitle(printing: AdminPrintingResponse): string {
  const markers = [printing.finish, ...printing.markerSlugs].filter(Boolean).join(" + ");
  return markers ? `${printingCodeLabel(printing)} · ${markers}` : printingCodeLabel(printing);
}
