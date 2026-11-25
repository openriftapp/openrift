import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";
import { useState } from "react";

import { useCardDetailData } from "@/features/admin/components/card-detail-shared";
import {
  acceptPrintingFieldFn,
  useAcceptPrintingField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { FieldSuggestions } from "@/features/catalog-workspace/components/pass/field-suggestions";
import { textChange } from "@/features/catalog-workspace/components/pass/field-text";
import { useSubmissionDecisions } from "@/features/catalog-workspace/components/pass/submission-decisions";
import {
  FaceFieldEditor,
  FaceFieldValue,
} from "@/features/catalog-workspace/components/record/face-field-editor";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import {
  CompareSourcesToggle,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useDismissSuggestion } from "@/features/catalog-workspace/hooks/use-dismiss-suggestion";
import {
  useFaceSuggestionWrites,
  useValueLabels,
} from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { FACE_FIELDS_FOR_READING } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

export function FaceFieldsSection({
  cardSlug,
  face,
  canEdit,
  compare,
  compareDisabledReason,
  detail,
  suggestions,
  isAdmin,
}: {
  cardSlug: string;
  face: AdminPrintingResponse;
  canEdit: boolean;
  compare?: ReactNode;
  compareDisabledReason?: string;
  detail: AdminCardDetailResponse;
  suggestions: readonly PrintingFieldSuggestion[];
  isAdmin: boolean;
}) {
  const labels = useValueLabels();
  const scope = [
    adminKeys.cards.detail(cardSlug),
    adminKeys.cards.list,
    adminKeys.printingDesk.all,
    adminKeys.workspace,
  ];
  const { printingSourceFields } = useCardDetailData(scope);
  const acceptField = useAcceptPrintingField(scope);
  const queueWrite = useQueueWorkspaceWrite();
  const { announce } = useWorkspaceUndo();
  const [editing, setEditing] = useState<ComparablePrintingField | null>(null);
  const [comparing, setComparing] = useState(false);
  const record = formatPrintingCode(face.publicCode);
  const costKeywords = useCostKeywords();
  const submissions = buildAttentionSubmissions(detail, costKeywords);
  const decisions = useSubmissionDecisions({ cardSlug, detail, submissions, isAdmin });
  const writes = useFaceSuggestionWrites({ cardSlug, record, face });
  const dismissValue = useDismissSuggestion(scope, record);

  const stored = (field: ComparablePrintingField) =>
    field === "setId" ? face.setSlug : face[field];

  async function save(field: ComparablePrintingField, value: unknown) {
    const label = PRINTING_FIELD_LABELS[field];
    let accepted = false;
    await queueWrite(async (signal) => {
      const accept = withSignal(acceptField.mutateAsync, signal);
      accepted = await acceptFieldWithUndo({
        accept,
        input: { printingId: face.id, faceId: face.faceId, field, value, source: "manual" },
        fieldLabel: label,
        sourceLabel: "your edit",
        previousValue: stored(field),
        onAccepted: (revert) =>
          announce({
            label: `Changed ${label} on ${record}`,
            undoneLabel: `Undone: ${label} restored on ${record}`,
            invalidates: undoScope(scope),
            undo: (undoSignal) =>
              revertAcceptedField(revert, (data) =>
                withWriteSignal(undoSignal, () =>
                  acceptPrintingFieldFn({ data, signal: undoSignal }),
                ),
              ),
          }),
      });
    });
    if (accepted) {
      setEditing(null);
    }
  }

  return (
    <RecordSection
      title="Face fields"
      actions={
        compare !== undefined && (
          <CompareSourcesToggle
            comparing={comparing}
            onToggle={() => setComparing(!comparing)}
            disabledReason={compareDisabledReason}
          />
        )
      }
    >
      {comparing && compare}
      <div className={comparing ? "hidden" : undefined}>
        {FACE_FIELDS_FOR_READING.map((field) => (
          <RecordFieldRow
            key={field}
            label={PRINTING_FIELD_LABELS[field]}
            value={<FaceFieldValue field={field} value={face[field]} labels={labels} />}
            onEdit={canEdit && editing === null ? () => setEditing(field) : undefined}
            suggestions={
              suggestions.some((suggestion) => suggestion.field === field) ? (
                <FieldSuggestions
                  suggestions={suggestions.filter((suggestion) => suggestion.field === field)}
                  detail={detail}
                  submissions={submissions}
                  decisions={decisions}
                  pending={writes.pending || dismissValue.pending}
                  format={(suggestion) => ({
                    value: formatCatalogFieldValue(field, suggestion.proposed, labels),
                    current: formatCatalogFieldValue(field, face[field], labels),
                    preview: textChange(field, face[field], suggestion.proposed),
                  })}
                  onUse={(suggestion) =>
                    void queueWrite((signal) =>
                      writes.applyChip(signal, { kind: "field", key: suggestion.key, suggestion }),
                    )
                  }
                  onDismiss={
                    isAdmin
                      ? (suggestion) =>
                          void dismissValue.run({
                            kind: "printing",
                            candidateId: suggestion.candidate.id,
                            field: suggestion.field,
                            value: suggestion.proposed,
                            label: suggestion.label,
                            source: suggestion.provider,
                          })
                      : undefined
                  }
                />
              ) : undefined
            }
            editing={
              editing === field ? (
                <FaceFieldEditor
                  field={field}
                  def={printingSourceFields.find((def) => def.key === field)}
                  value={stored(field)}
                  pending={acceptField.isPending}
                  onSave={(value) => void save(field, value)}
                  onCancel={() => setEditing(null)}
                />
              ) : undefined
            }
          />
        ))}
      </div>
      {decisions.dialogs}
    </RecordSection>
  );
}
