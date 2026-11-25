import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import { formatReleasePeriod } from "@openrift/shared/set-release";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";

import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue, formatReleaseValue } from "@/features/admin/lib/field-value-text";
import { ErrataPane } from "@/features/cards/components/errata-diff-pane";
import { diffCardText } from "@/features/cards/lib/errata-diff";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";

const CARD_TEXT_FIELDS: ReadonlySet<string> = new Set([
  "printedRulesText",
  "printedEffectText",
  "flavorText",
]);

export function faceHeading(face: AdminPrintingResponse, labels: PrintingValueLabels): string {
  return [
    formatPrintingCode(face.publicCode),
    face.language,
    formatCatalogFieldValue("finish", face.finish, labels),
  ].join(" · ");
}

export function textChange(field: string, current: unknown, proposed: unknown): ReactNode {
  if (!CARD_TEXT_FIELDS.has(field) || typeof proposed !== "string") {
    return null;
  }
  const segments = diffCardText(typeof current === "string" ? current : "", proposed);
  return (
    <ErrataPane
      title="Suggested text"
      tone="updated"
      side="corrected"
      className="basis-full"
      changes={[{ key: field, label: null, segments }]}
    />
  );
}

export function proposedValue(
  printing: AdminPrintingResponse,
  suggestion: PrintingFieldSuggestion,
  labels: PrintingValueLabels,
): string {
  if (suggestion.field === "releasedAt") {
    return formatReleaseValue(suggestion.proposed, suggestion.candidate.releasePrecision);
  }
  if (suggestion.field === "releasePrecision" && printing.releasedAt !== null) {
    return formatReleasePeriod({
      releasedAt: printing.releasedAt,
      precision: suggestion.proposed as ReleasePrecision,
    });
  }
  return formatCatalogFieldValue(suggestion.field, suggestion.proposed, labels);
}
