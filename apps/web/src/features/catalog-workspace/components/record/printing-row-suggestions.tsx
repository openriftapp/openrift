import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { FieldSuggestions } from "@/features/catalog-workspace/components/pass/field-suggestions";
import { proposedValue } from "@/features/catalog-workspace/components/pass/field-text";
import { useSubmissionDecisions } from "@/features/catalog-workspace/components/pass/submission-decisions";
import { useDismissSuggestion } from "@/features/catalog-workspace/hooks/use-dismiss-suggestion";
import { usePrintingFieldWrites } from "@/features/catalog-workspace/hooks/use-printing-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

export function PrintingRowSuggestions({
  fields,
  suggestions,
  printing,
  detail,
  cardSlug,
  isAdmin,
  labels,
}: {
  fields: readonly ComparablePrintingField[];
  suggestions: readonly PrintingFieldSuggestion[];
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  cardSlug: string;
  isAdmin: boolean;
  labels: PrintingValueLabels;
}) {
  const record = printing.expectedPrintingId;
  const costKeywords = useCostKeywords();
  const submissions = buildAttentionSubmissions(detail, costKeywords);
  const decisions = useSubmissionDecisions({ cardSlug, detail, submissions, isAdmin });
  const writes = usePrintingFieldWrites({ printingId: printing.id, record, printing });
  const queueWrite = useQueueWorkspaceWrite();
  const dismissValue = useDismissSuggestion(
    [adminKeys.cards.all, adminKeys.printingDesk.all, adminKeys.workspace],
    record,
  );

  const shown = suggestions.filter((suggestion) => fields.includes(suggestion.field));
  const precisionOf = (date: PrintingFieldSuggestion) =>
    shown.find(
      (other) => other.field === "releasePrecision" && other.candidate.id === date.candidate.id,
    );
  const rows = shown.filter(
    (suggestion) =>
      suggestion.field !== "releasePrecision" ||
      !shown.some(
        (other) => other.field === "releasedAt" && other.candidate.id === suggestion.candidate.id,
      ),
  );
  const withPrecision = (suggestion: PrintingFieldSuggestion) => {
    const precision = suggestion.field === "releasedAt" ? precisionOf(suggestion) : undefined;
    return precision === undefined ? [suggestion] : [suggestion, precision];
  };

  return (
    <>
      <FieldSuggestions
        suggestions={rows}
        detail={detail}
        submissions={submissions}
        decisions={decisions}
        pending={writes.pending || dismissValue.pending}
        format={(suggestion) => ({
          value: proposedValue(printing, suggestion, labels),
          preview: null,
          current:
            suggestion.field === "releasedAt" || suggestion.field === "releasePrecision"
              ? undefined
              : formatCatalogFieldValue(suggestion.field, printing[suggestion.field], labels),
        })}
        onUse={(suggestion) =>
          void queueWrite(async (signal) => {
            for (const part of withPrecision(suggestion)) {
              await writes.applyField(signal, part);
            }
          })
        }
        onDismiss={
          isAdmin
            ? (suggestion) => {
                for (const part of withPrecision(suggestion)) {
                  void dismissValue.run({
                    kind: "printing",
                    candidateId: part.candidate.id,
                    field: part.field,
                    value: part.proposed,
                    label: part.label,
                    source: part.provider,
                  });
                }
              }
            : undefined
        }
      />
      {decisions.dialogs}
    </>
  );
}
