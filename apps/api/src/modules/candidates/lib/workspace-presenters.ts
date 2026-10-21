import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  differingFields,
  hasFieldValue,
} from "@openrift/shared/catalog-field-compare";
import type {
  WorkspaceOwner,
  WorkspaceOwnerCounts,
  WorkspaceQueueItem,
  WorkspaceQueueResponse,
  WorkspaceReason,
  WorkspaceRecordKind,
  WorkspaceRecordRow,
  WorkspaceSegment,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { normalizeProvidedPrintingRecord } from "@openrift/shared/printing-value-normalize";

import { classifyAgainstLive } from "../../../lib/image-fingerprint.js";
import type {
  WorkspaceCardDifferenceRow,
  WorkspaceDraftRow,
  WorkspaceInactiveImageRow,
  WorkspaceLinkedPrintingRow,
  WorkspaceNewPrintingRow,
} from "../repositories/workspace-queue.js";
import type { WorkspaceRecordDbRow } from "../repositories/workspace-records.js";

interface WorkspaceSubmissionRow {
  id: string;
  provider: string;
  cardName: string;
  candidateCardId: string;
  cardSlug: string | null;
  proposedDiff: string[];
  createdAt: Date;
}

export interface WorkspaceQueueSources {
  cardDifferences: WorkspaceCardDifferenceRow[];
  drafts: WorkspaceDraftRow[];
  linkedPrintings: WorkspaceLinkedPrintingRow[];
  newPrintings: WorkspaceNewPrintingRow[];
  inactiveImages: WorkspaceInactiveImageRow[];
  submissions: WorkspaceSubmissionRow[];
  costKeywords: string[];
}

export interface WorkspaceQueueEntry {
  item: WorkspaceQueueItem;
  printingIds: string[];
}

interface Accumulator {
  base: Omit<WorkspaceQueueItem, "decisions" | "fields" | "createdAt">;
  fields: Set<string>;
  createdAt: Date;
  printingIds: Set<string>;
}

class EntryCollector {
  private readonly byId = new Map<string, Accumulator>();

  add(
    base: Omit<WorkspaceQueueItem, "decisions" | "fields" | "createdAt">,
    fields: readonly string[],
    createdAt: Date,
    printingIds: readonly string[] = [],
  ): void {
    const existing = this.byId.get(base.id);
    if (existing === undefined) {
      this.byId.set(base.id, {
        base,
        fields: new Set(fields),
        createdAt,
        printingIds: new Set(printingIds),
      });
      return;
    }
    for (const field of fields) {
      existing.fields.add(field);
    }
    for (const printingId of printingIds) {
      existing.printingIds.add(printingId);
    }
    if (createdAt < existing.createdAt) {
      existing.createdAt = createdAt;
    }
  }

  entries(): WorkspaceQueueEntry[] {
    return [...this.byId.values()].map((acc) => ({
      item: {
        ...acc.base,
        decisions: Math.max(acc.fields.size, 1),
        fields: [...acc.fields],
        createdAt: acc.createdAt.toISOString(),
      },
      printingIds: [...acc.printingIds],
    }));
  }
}

function itemId(owner: WorkspaceOwner, reason: WorkspaceReason, ...parts: string[]): string {
  return [owner, reason, ...parts].join(":");
}

function itemBase(
  owner: WorkspaceOwner,
  segment: WorkspaceSegment,
  reason: WorkspaceReason,
  ownerId: string,
  key: string | null,
  rest: Pick<WorkspaceQueueItem, "cardSlug" | "cardName" | "label" | "provider" | "isContributor">,
): Omit<WorkspaceQueueItem, "decisions" | "fields" | "createdAt"> {
  const id = key === null ? itemId(owner, reason, ownerId) : itemId(owner, reason, ownerId, key);
  return { id, owner, segment, ownerId, reason, ...rest };
}

function faceLabel(shortCode: string, isBack: boolean): string {
  return isBack ? `${shortCode} back` : shortCode;
}

interface LinkedPrintingDifferences {
  faceFields: string[];
  printingFields: string[];
  newImage: boolean;
}

/** Compares like `checkMatchingCandidates`, so a row it would auto-check yields nothing here. */
export function linkedPrintingDifferences(
  row: WorkspaceLinkedPrintingRow,
  costKeywords: string[],
): LinkedPrintingDifferences {
  const { imageUrl, imageFingerprint, ...candidate } = row.candidate;
  const { imageUrls, imageFingerprints, ...live } = row.live;
  const newImage =
    hasFieldValue(imageUrl) &&
    !imageUrls.includes(imageUrl as string) &&
    classifyAgainstLive(imageFingerprint, imageFingerprints) !== "same";
  const normalized = normalizeProvidedPrintingRecord(candidate, {
    costKeywords,
    printedTotal: row.printedTotal,
  });
  const fields = differingFields(COMPARABLE_PRINTING_FIELDS, live, normalized);
  return {
    faceFields: fields.filter((field) => !isPrintingLevelField(field)),
    printingFields: fields.filter((field) => isPrintingLevelField(field)),
    newImage,
  };
}

function contributorCardFields(proposedDiff: readonly string[]): string[] {
  return proposedDiff
    .filter((key) => key.startsWith("card.") && key !== "card.new")
    .map((key) => key.slice("card.".length));
}

export function buildWorkspaceQueueEntries(sources: WorkspaceQueueSources): WorkspaceQueueEntry[] {
  const collector = new EntryCollector();

  for (const row of sources.cardDifferences) {
    const fields = differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate);
    if (fields.length === 0) {
      continue;
    }
    collector.add(
      itemBase("card", "open", "source-difference", row.cardSlug, row.provider, {
        cardSlug: row.cardSlug,
        cardName: row.cardName,
        label: row.cardName,
        provider: row.provider,
        isContributor: false,
      }),
      fields,
      row.createdAt,
    );
  }

  const draftsByNormName = Map.groupBy(sources.drafts, (row) => row.normName);
  for (const [normName, rows] of draftsByNormName) {
    const [first] = rows.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (first === undefined) {
      continue;
    }
    collector.add(
      itemBase("card", "new", "new-card", normName, null, {
        cardSlug: null,
        cardName: first.name,
        label: first.name,
        provider: first.provider,
        isContributor: rows.some((row) => row.provider === USER_SUBMISSION_PROVIDER),
      }),
      [],
      first.createdAt,
    );
  }

  const coveredSubmissions = new Set<string>();
  for (const row of sources.linkedPrintings) {
    const { faceFields, printingFields, newImage } = linkedPrintingDifferences(
      row,
      sources.costKeywords,
    );
    const isContributor = row.provider === USER_SUBMISSION_PROVIDER;
    const reason: WorkspaceReason = isContributor ? "contributor-proposal" : "source-difference";
    const key = isContributor ? row.candidateCardId : row.provider;
    const label = faceLabel(row.faceShortCode, row.side === 2);
    const shared = { cardSlug: row.cardSlug, cardName: row.cardName, provider: row.provider };
    if (faceFields.length > 0) {
      collector.add(
        itemBase("face", "open", reason, row.faceId, key, { ...shared, label, isContributor }),
        faceFields,
        row.createdAt,
        [row.printingId],
      );
    }
    if (printingFields.length > 0) {
      collector.add(
        itemBase("printing", "open", reason, row.printingId, key, {
          ...shared,
          label: row.printingLabel,
          isContributor,
        }),
        printingFields,
        row.createdAt,
        [row.printingId],
      );
    }
    if (newImage) {
      collector.add(
        itemBase("face", "open", "new-image", row.faceId, key, { ...shared, label, isContributor }),
        [],
        row.createdAt,
        [row.printingId],
      );
    }
    if (isContributor && (faceFields.length > 0 || printingFields.length > 0 || newImage)) {
      coveredSubmissions.add(row.candidateCardId);
    }
  }

  for (const row of sources.newPrintings) {
    collector.add(
      itemBase("printing", "new", "new-printing", row.id, null, {
        cardSlug: row.cardSlug,
        cardName: row.cardName,
        label: [row.shortCode, row.finish, row.language].filter(Boolean).join(" "),
        provider: row.provider,
        isContributor: row.provider === USER_SUBMISSION_PROVIDER,
      }),
      [],
      row.createdAt,
    );
    if (row.provider === USER_SUBMISSION_PROVIDER) {
      coveredSubmissions.add(row.candidateCardId);
    }
  }

  for (const row of sources.inactiveImages) {
    collector.add(
      itemBase("face", "open", "new-image", row.faceId, row.imageId, {
        cardSlug: row.cardSlug,
        cardName: row.cardName,
        label: faceLabel(row.shortCode, row.isBack),
        provider: null,
        isContributor: true,
      }),
      [],
      row.createdAt,
      row.printingIds,
    );
  }

  for (const row of sources.submissions) {
    if (row.cardSlug === null) {
      continue;
    }
    const fields = contributorCardFields(row.proposedDiff);
    if (fields.length === 0 && coveredSubmissions.has(row.candidateCardId)) {
      continue;
    }
    collector.add(
      itemBase("card", "open", "contributor-proposal", row.cardSlug, row.id, {
        cardSlug: row.cardSlug,
        cardName: row.cardName,
        label: row.cardName,
        provider: row.provider,
        isContributor: true,
      }),
      fields,
      row.createdAt,
    );
  }

  return collector.entries();
}

function ownerCounts(items: readonly WorkspaceQueueItem[]): WorkspaceOwnerCounts {
  let oldestAt: string | null = null;
  let open = 0;
  let fresh = 0;
  for (const item of items) {
    if (item.segment === "open") {
      open += 1;
    } else {
      fresh += 1;
    }
    if (oldestAt === null || item.createdAt < oldestAt) {
      oldestAt = item.createdAt;
    }
  }
  return { open, new: fresh, oldestAt };
}

export function toWorkspaceQueueResponse(
  items: readonly WorkspaceQueueItem[],
  doneToday: number,
  owner?: WorkspaceOwner,
): WorkspaceQueueResponse {
  const sorted = items.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byOwner = (target: WorkspaceOwner) => sorted.filter((item) => item.owner === target);
  return {
    items: owner === undefined ? sorted : byOwner(owner),
    counts: {
      card: ownerCounts(byOwner("card")),
      face: ownerCounts(byOwner("face")),
      printing: ownerCounts(byOwner("printing")),
    },
    doneToday,
  };
}

export interface DeskRecordScope {
  promoIds: ReadonlySet<string>;
  createdIds: ReadonlySet<string>;
}

export function toWorkspaceRecordRow(
  row: WorkspaceRecordDbRow,
  kind: WorkspaceRecordKind,
  desk?: DeskRecordScope,
): WorkspaceRecordRow {
  const base = {
    id: row.id,
    cardSlug: row.cardSlug,
    cardName: row.cardName,
    setName: row.setName,
    shortCode: row.shortCode,
    language: row.language,
    finish: row.finish,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
  if (kind === "face") {
    return { ...base, printingCount: row.count };
  }
  if (desk === undefined) {
    return { ...base, faceCount: row.count };
  }
  return {
    ...base,
    faceCount: row.count,
    isPromo: desk.promoIds.has(row.id),
    createdByMe: desk.createdIds.has(row.id),
  };
}
