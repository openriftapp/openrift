import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";
import { useState } from "react";

import { useCardDetailData } from "@/features/admin/components/card-detail-shared";
import { markFieldAccept } from "@/features/admin/lib/accept-undo";
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
import { useFaceSuggestionWrites } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { usePrintingFieldAccept } from "@/features/catalog-workspace/hooks/use-suggestion-writes";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-value-labels";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";
import { FACE_FIELDS_FOR_READING } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorText } from "@/lib/error-text";

export function FaceFieldsSection({
  cardSlug,
  face,
  canEdit,
  compare,
  compareDisabledReason,
  detail,
  suggestions,
  isAdmin,
  title = "Face fields",
}: {
  cardSlug: string;
  face: AdminPrintingResponse;
  canEdit: boolean;
  compare?: ReactNode;
  compareDisabledReason?: string;
  detail: AdminCardDetailResponse;
  suggestions: readonly PrintingFieldSuggestion[];
  isAdmin: boolean;
  title?: string;
}) {
  const labels = useValueLabels();
  const scope = cardRecordScope(cardSlug);
  const { printingSourceFields } = useCardDetailData(scope);
  const queueWrite = useQueueWorkspaceWrite();
  const [editing, setEditing] = useState<ComparablePrintingField | null>(null);
  const [comparing, setComparing] = useState(false);
  const record = formatPrintingCode(face.publicCode);
  const costKeywords = useCostKeywords();
  const submissions = buildAttentionSubmissions(detail, costKeywords);
  const decisions = useSubmissionDecisions({ cardSlug, detail, submissions, isAdmin });
  const writes = useFaceSuggestionWrites({
    cardSlug,
    record,
    face,
    contributorName: (candidateCardId) =>
      passContributor(detail, submissions, candidateCardId).name,
  });
  const fieldAccept = usePrintingFieldAccept(scope, record, { inlineError: true });
  const dismissValue = useDismissSuggestion(scope, record);

  const stored = (field: ComparablePrintingField) =>
    field === "setId" ? face.setSlug : face[field];

  async function save(field: ComparablePrintingField, value: unknown) {
    const label = PRINTING_FIELD_LABELS[field];
    let accepted = false;
    const mark = markFieldAccept();
    await queueWrite(async (signal) => {
      accepted = await fieldAccept.accept(signal, {
        mark,
        input: { printingId: face.id, faceId: face.faceId, field, value, source: "manual" },
        label,
        sourceLabel: "your edit",
        previousValue: stored(field),
        undoText: {
          label: `Changed ${label} on ${record}`,
          undoneLabel: `Undone: ${label} restored on ${record}`,
        },
      });
    });
    if (accepted) {
      setEditing(null);
    }
  }

  return (
    <RecordSection
      title={title}
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
            onEdit={
              canEdit && editing === null
                ? () => {
                    fieldAccept.reset();
                    setEditing(field);
                  }
                : undefined
            }
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
                    void writes.apply({ kind: "field", key: suggestion.key, suggestion })
                  }
                  onDismiss={
                    isAdmin
                      ? (group) =>
                          void dismissValue.run(
                            group.map((suggestion) => ({
                              kind: "printing" as const,
                              candidateId: suggestion.candidatePrintingId,
                              field: suggestion.field,
                              value: suggestion.proposed,
                              label: suggestion.label,
                              source: suggestion.sourceLabel,
                            })),
                          )
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
                  pending={fieldAccept.pending}
                  error={
                    fieldAccept.error === null
                      ? null
                      : errorText(fieldAccept.error, "Could not save the field.")
                  }
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
