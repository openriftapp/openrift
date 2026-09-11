import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  hasFieldValue,
  sameFieldValue,
} from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingGroupResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import {
  CARD_FIELD_LABELS,
  DIFFED_FIELDS,
  PRINTING_FIELD_LABELS,
} from "@/features/admin/lib/catalog-field-labels";
import { summarizeCandidatePrinting } from "@/features/admin/lib/printing-fields";

type AttentionChangeKind = "value" | "text" | "image";

export interface AttentionChange {
  key: string;
  field: string;
  label: string;
  current: unknown;
  proposed: unknown;
  kind: AttentionChangeKind;
}

type AttentionGroupKind = "card" | "printing" | "new-printing";

export interface AttentionGroup {
  key: string;
  kind: AttentionGroupKind;
  title: string;
  printingLabel: string | null;
  language: string | null;
  printingId: string | null;
  candidate: CandidatePrintingResponse | null;
  changes: AttentionChange[];
  unchangedFields: string[];
  summary: string | null;
}

export interface AttentionSubmission {
  candidateCardId: string;
  provider: string;
  submitterName: string | null;
  note: string | null;
  kind: "correction" | "image";
  groups: AttentionGroup[];
}

export interface AttentionSourceEntry {
  candidateCardId: string;
  label: string;
  externalId: string;
  groups: AttentionGroup[];
  changedFields: number;
  newPrintings: number;
}

export interface AttentionSourceBlock {
  provider: string;
  candidateCardIds: string[];
  entries: AttentionSourceEntry[];
  changedFields: number;
  newPrintings: number;
}

function activeImageUrl(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): string | null {
  const active = images.find((image) => image.printingId === printingId && image.isActive);
  if (!active) {
    return null;
  }
  return active.rehostedUrl ?? active.originalUrl;
}

function changeKind(field: string): AttentionChangeKind {
  if (field === "imageUrl") {
    return "image";
  }
  return DIFFED_FIELDS.has(field) ? "text" : "value";
}

function compareFields(
  groupKey: string,
  fields: readonly string[],
  labels: Record<string, string>,
  current: Record<string, unknown> | null,
  proposed: Record<string, unknown>,
): { changes: AttentionChange[]; unchangedFields: string[] } {
  const changes: AttentionChange[] = [];
  const unchangedFields: string[] = [];
  for (const field of fields) {
    const proposedValue = proposed[field];
    if (!hasFieldValue(proposedValue)) {
      continue;
    }
    const currentValue = current?.[field] ?? null;
    if (sameFieldValue(currentValue, proposedValue, field)) {
      unchangedFields.push(labels[field] ?? field);
      continue;
    }
    changes.push({
      key: `${groupKey}:${field}`,
      field,
      label: labels[field] ?? field,
      current: currentValue,
      proposed: proposedValue,
      kind: changeKind(field),
    });
  }
  return { changes, unchangedFields };
}

function buildCardGroup(
  source: CandidateCardResponse,
  card: AdminCardDetailResponse["card"],
): AttentionGroup | null {
  const groupKey = `card:${source.id}`;
  const { changes, unchangedFields } = compareFields(
    groupKey,
    COMPARABLE_CARD_FIELDS,
    CARD_FIELD_LABELS,
    card as Record<string, unknown> | null,
    source as unknown as Record<string, unknown>,
  );
  if (changes.length === 0) {
    return null;
  }
  return {
    key: groupKey,
    kind: "card",
    title: "Card",
    printingLabel: null,
    language: null,
    printingId: null,
    candidate: null,
    changes,
    unchangedFields,
    summary: null,
  };
}

function buildLinkedPrintingGroup(
  candidate: CandidatePrintingResponse,
  printing: AdminPrintingResponse,
  images: readonly AdminPrintingImageResponse[] | null,
): AttentionGroup | null {
  const groupKey = `printing:${candidate.id}`;
  const { changes, unchangedFields } = compareFields(
    groupKey,
    COMPARABLE_PRINTING_FIELDS,
    PRINTING_FIELD_LABELS,
    printing as unknown as Record<string, unknown>,
    candidate as unknown as Record<string, unknown>,
  );

  if (images !== null) {
    const currentImage = activeImageUrl(printing.id, images);
    if (hasFieldValue(candidate.imageUrl) && candidate.imageUrl !== currentImage) {
      changes.push({
        key: `${groupKey}:imageUrl`,
        field: "imageUrl",
        label: "Image",
        current: currentImage,
        proposed: candidate.imageUrl,
        kind: "image",
      });
    }
  }

  if (changes.length === 0) {
    return null;
  }

  return {
    key: groupKey,
    kind: "printing",
    title: "Printing",
    printingLabel: printing.expectedPrintingId,
    language: printing.language,
    printingId: printing.id,
    candidate,
    changes,
    unchangedFields,
    summary: null,
  };
}

function buildNewPrintingGroup(
  candidate: CandidatePrintingResponse,
  apiGroup: CandidatePrintingGroupResponse | undefined,
): AttentionGroup {
  return {
    key: `new-printing:${candidate.id}`,
    kind: "new-printing",
    title: "New printing",
    printingLabel: apiGroup?.expectedPrintingId ?? candidate.shortCode,
    language: apiGroup?.language ?? candidate.language,
    printingId: null,
    candidate,
    changes: [],
    unchangedFields: [],
    summary: summarizeCandidatePrinting(candidate),
  };
}

export function buildAttentionSubmissions(detail: AdminCardDetailResponse): AttentionSubmission[] {
  const printingsById = new Map(detail.printings.map((printing) => [printing.id, printing]));
  const groupByCandidateId = new Map(
    detail.candidatePrintingGroups.flatMap((group) =>
      group.shortCodes.map((candidateId) => [candidateId, group] as const),
    ),
  );

  return detail.sources
    .filter((source) => source.provider === USER_SUBMISSION_PROVIDER && source.checkedAt === null)
    .map((source) => {
      const groups: AttentionGroup[] = [];
      const cardGroup = buildCardGroup(source, detail.card);
      if (cardGroup) {
        groups.push(cardGroup);
      }

      for (const candidate of detail.candidatePrintings) {
        if (candidate.candidateCardId !== source.id) {
          continue;
        }
        if (candidate.printingId === null) {
          groups.push(buildNewPrintingGroup(candidate, groupByCandidateId.get(candidate.id)));
          continue;
        }
        const printing = printingsById.get(candidate.printingId);
        if (!printing) {
          continue;
        }
        const group = buildLinkedPrintingGroup(candidate, printing, detail.printingImages);
        if (group) {
          groups.push(group);
        }
      }

      const changes = groups.flatMap((group) => group.changes);
      const onlyImages =
        changes.length > 0 &&
        changes.every((change) => change.kind === "image") &&
        groups.every((group) => group.kind !== "new-printing");

      return {
        candidateCardId: source.id,
        provider: source.provider,
        submitterName: source.submittedByName,
        note: source.submissionNote,
        kind: onlyImages ? ("image" as const) : ("correction" as const),
        groups,
      };
    })
    .filter((submission) => submission.groups.length > 0);
}

interface SourceEntryDraft extends AttentionSourceEntry {
  provider: string;
}

function buildSourceEntry(
  detail: AdminCardDetailResponse,
  source: CandidateCardResponse,
  printingsById: ReadonlyMap<string, AdminPrintingResponse>,
): SourceEntryDraft | null {
  const unchecked = detail.candidatePrintings.filter(
    (candidate) => candidate.candidateCardId === source.id && candidate.checkedAt === null,
  );
  if (source.checkedAt !== null && unchecked.length === 0) {
    return null;
  }

  const groups: AttentionGroup[] = [];
  if (source.checkedAt === null) {
    const cardGroup = buildCardGroup(source, detail.card);
    if (cardGroup) {
      groups.push(cardGroup);
    }
  }

  let newPrintings = 0;
  for (const candidate of unchecked) {
    if (candidate.printingId === null) {
      newPrintings += 1;
      continue;
    }
    const printing = printingsById.get(candidate.printingId);
    if (!printing) {
      continue;
    }
    const group = buildLinkedPrintingGroup(candidate, printing, null);
    if (group) {
      groups.push(group);
    }
  }

  return {
    provider: source.provider,
    candidateCardId: source.id,
    label: source.shortCode ?? source.externalId,
    externalId: source.externalId,
    groups,
    changedFields: groups.reduce((total, group) => total + group.changes.length, 0),
    newPrintings,
  };
}

function disambiguateLabels(entries: readonly SourceEntryDraft[]): AttentionSourceEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1);
  }
  return entries.map((entry) =>
    (counts.get(entry.label) ?? 0) > 1
      ? { ...entry, label: `${entry.label} · ${entry.externalId}` }
      : entry,
  );
}

export function buildAttentionSources(
  detail: AdminCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
): AttentionSourceBlock[] {
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const printingsById = new Map(detail.printings.map((printing) => [printing.id, printing]));

  const entries = detail.sources.flatMap((source) => {
    if (source.provider === USER_SUBMISSION_PROVIDER || !trusted.has(source.provider)) {
      return [];
    }
    const entry = buildSourceEntry(detail, source, printingsById);
    return entry === null ? [] : [entry];
  });

  return [...Map.groupBy(entries, (entry) => entry.provider)].map(([provider, list]) => ({
    provider,
    candidateCardIds: list.map((entry) => entry.candidateCardId),
    entries: disambiguateLabels(list),
    changedFields: list.reduce((total, entry) => total + entry.changedFields, 0),
    newPrintings: list.reduce((total, entry) => total + entry.newPrintings, 0),
  }));
}

export function attentionCount(
  submissions: readonly AttentionSubmission[],
  sources: readonly AttentionSourceBlock[],
): number {
  return submissions.length + sources.length;
}
