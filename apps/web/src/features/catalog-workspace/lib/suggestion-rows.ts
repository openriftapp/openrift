import type { ComparableCardField } from "@openrift/shared/catalog-field-compare";
import {
  COMPARABLE_CARD_FIELDS,
  hasFieldValue,
  sameFieldValue,
} from "@openrift/shared/catalog-field-compare";
import type { WorkspaceSameDifferenceInput } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";

type SuggestionTone = "source" | "contributor";

const MAX_SUGGESTION_HOTKEY = 9;

export interface FieldSuggestion {
  key: string;
  field: ComparableCardField;
  tone: SuggestionTone;
  sourceKey: string;
  sourceLabel: string;
  value: unknown;
  candidateRowId: string;
  rowDifferences: number;
  changeKey?: string;
  otherChanges?: number;
  hotkey?: number;
}

export interface SuggestionRow {
  field: ComparableCardField;
  label: string;
  currentValue: unknown;
  suggestions: FieldSuggestion[];
}

interface SourceDifferences {
  key: string;
  label: string;
  tone: SuggestionTone;
  differences: number;
  trusted: boolean;
}

export interface EnterTarget {
  candidateRowId: string;
  provider: string;
  differences: number;
}

export interface CardSuggestions {
  rows: SuggestionRow[];
  suggestions: FieldSuggestion[];
  sources: SourceDifferences[];
  agreedLabels: string[];
  enterTargets: EnterTarget[];
  openContributorIds: string[];
}

function contributorSourceKey(candidateCardId: string): string {
  return `contributor:${candidateCardId}`;
}

function submissionChangeCount(submission: AttentionSubmission): number {
  return submission.groups.reduce(
    (total, group) => total + (group.kind === "new-printing" ? 1 : group.changes.length),
    0,
  );
}

export function buildCardSuggestions(
  detail: AdminCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
  submissions: readonly AttentionSubmission[],
): CardSuggestions {
  const card = (detail.card ?? {}) as Record<string, unknown>;
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const openSources = detail.sources.filter(
    (source) => source.provider !== USER_SUBMISSION_PROVIDER && source.checkedAt === null,
  );

  const byField = new Map<ComparableCardField, FieldSuggestion[]>(
    COMPARABLE_CARD_FIELDS.map((field) => [field, []]),
  );
  const enterTargets: EnterTarget[] = [];

  for (const source of openSources) {
    const proposed = source as unknown as Record<string, unknown>;
    const differing = COMPARABLE_CARD_FIELDS.filter(
      (field) =>
        hasFieldValue(proposed[field]) &&
        !sameFieldValue(card[field] ?? null, proposed[field], field),
    );
    enterTargets.push({
      candidateRowId: source.id,
      provider: source.provider,
      differences: differing.length,
    });
    for (const field of differing) {
      byField.get(field)?.push({
        key: `${source.id}:${field}`,
        field,
        tone: "source",
        sourceKey: source.provider,
        sourceLabel: source.provider,
        value: proposed[field],
        candidateRowId: source.id,
        rowDifferences: differing.length,
      });
    }
  }

  const contributorSources: SourceDifferences[] = [];
  const openContributorIds: string[] = [];
  for (const submission of submissions) {
    const cardChanges = submission.groups
      .filter((group) => group.kind === "card")
      .flatMap((group) => group.changes);
    if (cardChanges.length === 0) {
      continue;
    }
    openContributorIds.push(submission.candidateCardId);
    const label = submission.submitterName ?? "Contributor";
    const total = submissionChangeCount(submission);
    contributorSources.push({
      key: contributorSourceKey(submission.candidateCardId),
      label,
      tone: "contributor",
      differences: cardChanges.length,
      trusted: false,
    });
    for (const change of cardChanges) {
      const field = change.field as ComparableCardField;
      byField.get(field)?.push({
        key: change.key,
        field,
        tone: "contributor",
        sourceKey: contributorSourceKey(submission.candidateCardId),
        sourceLabel: label,
        value: change.proposed,
        candidateRowId: submission.candidateCardId,
        rowDifferences: cardChanges.length,
        changeKey: change.key,
        otherChanges: total - 1,
      });
    }
  }

  let hotkey = 0;
  const rows: SuggestionRow[] = COMPARABLE_CARD_FIELDS.map((field) => ({
    field,
    label: CARD_FIELD_LABELS[field],
    currentValue: card[field] ?? null,
    suggestions: (byField.get(field) ?? []).map((suggestion) => {
      hotkey += 1;
      return hotkey <= MAX_SUGGESTION_HOTKEY ? { ...suggestion, hotkey } : suggestion;
    }),
  }));

  const providerSources = [...Map.groupBy(enterTargets, (target) => target.provider)].map(
    ([provider, targets]): SourceDifferences => ({
      key: provider,
      label: provider,
      tone: "source",
      differences: targets.reduce((total, target) => total + target.differences, 0),
      trusted: trusted.has(provider),
    }),
  );

  return {
    rows,
    suggestions: rows.flatMap((row) => row.suggestions),
    sources: [...providerSources, ...contributorSources],
    agreedLabels: rows.filter((row) => row.suggestions.length === 0).map((row) => row.label),
    enterTargets,
    openContributorIds,
  };
}

export function discardLabel(suggestion: FieldSuggestion): string {
  return suggestion.rowDifferences <= 1
    ? "Discard"
    : `Discard ${suggestion.rowDifferences} from ${suggestion.sourceLabel}`;
}

export function sameDifferenceInput(
  suggestion: FieldSuggestion,
): WorkspaceSameDifferenceInput | null {
  if (suggestion.tone !== "source") {
    return null;
  }
  return {
    provider: suggestion.sourceKey,
    field: suggestion.field,
    value: JSON.stringify(suggestion.value),
  };
}

export function suggestionByHotkey(
  suggestions: readonly FieldSuggestion[],
  hotkey: number,
): FieldSuggestion | undefined {
  return suggestions.find((suggestion) => suggestion.hotkey === hotkey);
}

export function enterProviders(targets: readonly EnterTarget[]): string[] {
  return [
    ...new Set(targets.filter((target) => target.differences > 0).map((target) => target.provider)),
  ];
}

export function enterDifferenceCount(targets: readonly EnterTarget[]): number {
  return targets.reduce((total, target) => total + target.differences, 0);
}
