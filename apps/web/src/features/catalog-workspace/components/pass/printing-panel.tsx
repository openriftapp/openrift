import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import { formatReleasePeriod } from "@openrift/shared/set-release";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue, formatReleaseValue } from "@/features/admin/lib/field-value-text";
import { PrintingCompareGrid } from "@/features/catalog-workspace/components/compare-sources-dialog";
import {
  ContributionBlock,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { usePrintingFieldWrites } from "@/features/catalog-workspace/hooks/use-printing-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PassPrinting } from "@/features/catalog-workspace/lib/card-pass";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { PRINTING_FIELDS } from "@/features/catalog-workspace/lib/face-suggestion-rows";

function currentValue(
  printing: AdminPrintingResponse,
  field: ComparablePrintingField,
  labels: PrintingValueLabels,
): string {
  if (field === "releasedAt") {
    return formatReleaseValue(printing.releasedAt, printing.releasePrecision);
  }
  return formatCatalogFieldValue(field, printing[field], labels);
}

function proposedValue(
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

function PrintingFaces({
  cardSlug,
  cardName,
  printing,
}: {
  cardSlug: string;
  cardName: string;
  printing: AdminPrintingResponse;
}) {
  const own = `${cardName} (${formatPrintingCode(printing.publicCode)})`;
  const other = printing.otherFace;
  const otherName =
    other === null ? null : (
      <>
        {other.cardName} ({formatPrintingCode(other.publicCode)})
        {other.cardSlug !== cardSlug && (
          <>
            {" · edited in "}
            <TextLink
              render={
                <Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug: other.cardSlug }} />
              }
            >
              its card pass
            </TextLink>
          </>
        )}
      </>
    );
  const [first, second] = printing.side === 2 ? [otherName, own] : [own, otherName];
  return (
    <span className="flex flex-col">
      <span>Face 1: {first}</span>
      {second !== null && <span>Face 2: {second}</span>}
    </span>
  );
}

export function PrintingPanel({
  cardSlug,
  detail,
  entry,
  submissions,
  providerSettings,
  hiddenProviders,
  costKeywords,
  isAdmin,
  labels,
  onReject,
  onMove,
  onMarkApplied,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  entry: PassPrinting;
  submissions: readonly AttentionSubmission[];
  providerSettings: ProviderSettingResponse[];
  hiddenProviders: ReadonlySet<string>;
  costKeywords: readonly string[];
  isAdmin: boolean;
  labels: PrintingValueLabels;
  onReject: (candidateCardId: string, kindLabel: string) => void;
  onMove?: (candidateCardId: string) => void;
  onMarkApplied: (candidateCardId: string) => void;
}) {
  const { printing, model } = entry;
  const writes = usePrintingFieldWrites({
    printingId: printing.id,
    record: printing.expectedPrintingId,
    printing,
  });
  const queueWrite = useQueueWorkspaceWrite();
  const [comparing, setComparing] = useState(false);

  const fields = PRINTING_FIELDS.filter((field) =>
    model.suggestions.some((suggestion) => suggestion.field === field),
  );
  const apply = (suggestion: PrintingFieldSuggestion) =>
    void queueWrite((signal) => writes.applyField(signal, suggestion));

  return (
    <div className="flex flex-col gap-1 rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-1">
          <TextLink
            variant="inherit"
            className="font-medium"
            render={
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId: printing.id }}
              />
            }
          >
            {printing.expectedPrintingId}
          </TextLink>
        </span>
        <Button variant="link" size="xs" onClick={() => setComparing((value) => !value)}>
          {comparing ? "Close compare" : "Compare fields"}
        </Button>
      </div>

      {comparing ? (
        <PrintingCompareGrid
          printingId={printing.id}
          cardSlugs={[cardSlug]}
          details={[detail]}
          providerSettings={providerSettings}
          hiddenProviders={hiddenProviders}
          costKeywords={costKeywords}
          isAdmin={isAdmin}
        />
      ) : (
        <div>
          {fields.map((field) => (
            <RecordFieldRow
              key={field}
              label={PRINTING_FIELD_LABELS[field]}
              value={currentValue(printing, field, labels)}
              suggestions={model.suggestions
                .filter((suggestion) => suggestion.field === field)
                .map((suggestion) => {
                  const value = proposedValue(printing, suggestion, labels);
                  if (!suggestion.isContributor) {
                    return (
                      <SourceUse
                        key={suggestion.key}
                        value={value}
                        source={suggestion.provider}
                        pending={writes.pending}
                        onUse={() => apply(suggestion)}
                      />
                    );
                  }
                  const contributor = passContributor(
                    detail,
                    submissions,
                    suggestion.candidate.candidateCardId,
                  );
                  return (
                    <ContributionBlock
                      key={suggestion.key}
                      {...contributor}
                      value={value}
                      pending={writes.pending}
                      onUse={() => apply(suggestion)}
                      onReject={() => onReject(suggestion.candidate.candidateCardId, "Correction")}
                      onMove={onMove && (() => onMove(suggestion.candidate.candidateCardId))}
                      onMarkApplied={() => onMarkApplied(suggestion.candidate.candidateCardId)}
                    />
                  );
                })}
            />
          ))}
          <RecordFieldRow
            label="Faces"
            value={
              <PrintingFaces
                cardSlug={cardSlug}
                cardName={detail.displayName}
                printing={printing}
              />
            }
          />
        </div>
      )}
    </div>
  );
}
