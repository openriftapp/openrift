import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import {
  CARD_FIELD_LABELS,
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  DIFFED_FIELDS,
  hasFieldValue,
  PRINTING_FIELD_LABELS,
  sameFieldValue,
} from "@/features/catalog-admin/lib/catalog-field-labels";
import { summarizeCandidatePrinting } from "@/features/catalog-admin/lib/printing-fields";

export type AttentionChangeKind = "value" | "text" | "image";

export interface AttentionChange {
  key: string;
  field: string;
  label: string;
  current: unknown;
  proposed: unknown;
  kind: AttentionChangeKind;
}

export type AttentionGroupKind = "card" | "printing" | "new-printing";

export interface AttentionGroup {
  key: string;
  kind: AttentionGroupKind;
  title: string;
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

export interface AttentionSourceBlock {
  provider: string;
  candidateCardId: string;
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
  images: readonly AdminPrintingImageResponse[],
): AttentionGroup | null {
  const groupKey = `printing:${candidate.id}`;
  const { changes, unchangedFields } = compareFields(
    groupKey,
    COMPARABLE_PRINTING_FIELDS,
    PRINTING_FIELD_LABELS,
    printing as unknown as Record<string, unknown>,
    candidate as unknown as Record<string, unknown>,
  );

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

  if (changes.length === 0) {
    return null;
  }

  const language = printing.language;
  return {
    key: groupKey,
    kind: "printing",
    title: `Printing ${printing.shortCode}${language ? ` · ${language.toUpperCase()}` : ""}`,
    printingId: printing.id,
    candidate,
    changes,
    unchangedFields,
    summary: null,
  };
}

function buildNewPrintingGroup(candidate: CandidatePrintingResponse): AttentionGroup {
  const finish = hasFieldValue(candidate.finish) ? ` · ${candidate.finish}` : "";
  return {
    key: `new-printing:${candidate.id}`,
    kind: "new-printing",
    title: `New printing ${candidate.shortCode}${finish}`,
    printingId: null,
    candidate,
    changes: [],
    unchangedFields: [],
    summary: summarizeCandidatePrinting(candidate),
  };
}

export function buildAttentionSubmissions(detail: AdminCardDetailResponse): AttentionSubmission[] {
  const printingsById = new Map(detail.printings.map((printing) => [printing.id, printing]));

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
          groups.push(buildNewPrintingGroup(candidate));
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

export function buildAttentionSources(
  detail: AdminCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
): AttentionSourceBlock[] {
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const printingsById = new Map(detail.printings.map((printing) => [printing.id, printing]));

  const blocks: AttentionSourceBlock[] = [];
  for (const source of detail.sources) {
    if (source.provider === USER_SUBMISSION_PROVIDER || !trusted.has(source.provider)) {
      continue;
    }
    const candidates = detail.candidatePrintings.filter(
      (candidate) => candidate.candidateCardId === source.id,
    );
    const uncheckedCandidates = candidates.filter((candidate) => candidate.checkedAt === null);
    if (source.checkedAt !== null && uncheckedCandidates.length === 0) {
      continue;
    }

    let changedFields = 0;
    if (source.checkedAt === null) {
      changedFields += compareFields(
        source.id,
        COMPARABLE_CARD_FIELDS,
        CARD_FIELD_LABELS,
        detail.card as Record<string, unknown> | null,
        source as unknown as Record<string, unknown>,
      ).changes.length;
    }

    let newPrintings = 0;
    for (const candidate of uncheckedCandidates) {
      if (candidate.printingId === null) {
        newPrintings += 1;
        continue;
      }
      const printing = printingsById.get(candidate.printingId);
      if (!printing) {
        continue;
      }
      changedFields += compareFields(
        candidate.id,
        COMPARABLE_PRINTING_FIELDS,
        PRINTING_FIELD_LABELS,
        printing as unknown as Record<string, unknown>,
        candidate as unknown as Record<string, unknown>,
      ).changes.length;
    }

    blocks.push({
      provider: source.provider,
      candidateCardId: source.id,
      changedFields,
      newPrintings,
    });
  }
  return blocks;
}

export function attentionCount(
  submissions: readonly AttentionSubmission[],
  sources: readonly AttentionSourceBlock[],
): number {
  return submissions.length + sources.length;
}
