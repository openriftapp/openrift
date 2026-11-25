import type {
  ComparableCardField,
  ComparablePrintingField,
} from "@openrift/shared/catalog-field-compare";
import { COMPARABLE_CARD_FIELDS } from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  CARD_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
} from "@/features/admin/lib/catalog-field-labels";
import type { CompareContext } from "@/features/admin/lib/source-compare";
import {
  cardDifferences,
  isContributorProvider,
  printingDifferences,
} from "@/features/admin/lib/source-compare";

export interface FieldSuggestion<F extends string = ComparableCardField | ComparablePrintingField> {
  key: string;
  field: F;
  label: string;
  current: unknown;
  proposed: unknown;
  provider: string;
  sourceLabel: string;
  isContributor: boolean;
  candidateCardId: string;
  changeKey?: string;
}

export interface PrintingFieldSuggestion extends FieldSuggestion<ComparablePrintingField> {
  candidatePrintingId: string;
  printingId: string;
  faceId: string;
  releasePrecision: CandidatePrintingResponse["releasePrecision"];
}

interface SuggestionRow {
  field: ComparableCardField;
  label: string;
  currentValue: unknown;
  suggestions: FieldSuggestion<ComparableCardField>[];
}

interface EnterTarget {
  candidateRowId: string;
  provider: string;
  differences: number;
}

export interface CardSuggestions {
  rows: SuggestionRow[];
  enterTargets: EnterTarget[];
}

export function submissionChangeCount(submission: AttentionSubmission): number {
  return submission.groups.reduce(
    (total, group) => total + (group.kind === "new-printing" ? 1 : group.changes.length),
    0,
  );
}

export function buildCardSuggestions(
  detail: AdminCardDetailResponse,
  submissions: readonly AttentionSubmission[],
): CardSuggestions {
  const card = (detail.card ?? {}) as Record<string, unknown>;
  const openSources = detail.sources.filter(
    (source) => source.provider !== USER_SUBMISSION_PROVIDER && source.checkedAt === null,
  );

  const byField = new Map<ComparableCardField, FieldSuggestion<ComparableCardField>[]>(
    COMPARABLE_CARD_FIELDS.map((field) => [field, []]),
  );
  const enterTargets: EnterTarget[] = [];

  for (const source of openSources) {
    const differences = cardDifferences(detail.card, source);
    enterTargets.push({
      candidateRowId: source.id,
      provider: source.provider,
      differences: differences.length,
    });
    for (const { field, current, proposed } of differences) {
      byField.get(field)?.push({
        key: `${source.id}:${field}`,
        field,
        label: CARD_FIELD_LABELS[field],
        current,
        proposed,
        provider: source.provider,
        sourceLabel: source.provider,
        isContributor: false,
        candidateCardId: source.id,
      });
    }
  }

  for (const submission of submissions) {
    const label = submission.submitterName ?? "Contributor";
    const changes = submission.groups
      .filter((group) => group.kind === "card")
      .flatMap((group) => group.changes);
    for (const change of changes) {
      const field = change.field as ComparableCardField;
      byField.get(field)?.push({
        key: change.key,
        field,
        label: CARD_FIELD_LABELS[field],
        current: card[field] ?? null,
        proposed: change.proposed,
        provider: submission.provider,
        sourceLabel: label,
        isContributor: true,
        candidateCardId: submission.candidateCardId,
        changeKey: change.key,
      });
    }
  }

  return {
    rows: COMPARABLE_CARD_FIELDS.map((field) => ({
      field,
      label: CARD_FIELD_LABELS[field],
      currentValue: card[field] ?? null,
      suggestions: byField.get(field) ?? [],
    })),
    enterTargets,
  };
}

export function printingFieldSuggestions(
  candidate: CandidatePrintingResponse,
  row: AdminPrintingResponse,
  fields: readonly ComparablePrintingField[],
  context: CompareContext,
  provider: string,
): PrintingFieldSuggestion[] {
  return printingDifferences(candidate, row, fields, context).map(
    ({ field, current, proposed }) => ({
      key: `${candidate.id}:${field}`,
      field,
      label: PRINTING_FIELD_LABELS[field],
      current,
      proposed,
      provider,
      sourceLabel: provider,
      isContributor: isContributorProvider(provider),
      candidateCardId: candidate.candidateCardId,
      candidatePrintingId: candidate.id,
      printingId: row.id,
      faceId: row.faceId,
      releasePrecision: candidate.releasePrecision,
    }),
  );
}
