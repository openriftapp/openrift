import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { unlinkedGroupCandidates } from "@/features/admin/lib/candidate-groups";
import type { SetReleaseYears } from "@/features/admin/lib/set-release-years";
import {
  hiddenProviders as hiddenProvidersFor,
  providerOf,
} from "@/features/admin/lib/source-compare";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromCandidatePrinting,
  duplicateProbeFromAdminPrinting,
  findDuplicateCandidates,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";
import type {
  FaceSuggestionModel,
  SuggestionSource,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { buildFaceSuggestions } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { closestPrintings } from "@/features/catalog-workspace/lib/printing-matches";
import type { PrintingSuggestionModel } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { buildPrintingSuggestions } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import type { CardSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";
import {
  buildCardSuggestions,
  submissionChangeCount,
} from "@/features/catalog-workspace/lib/suggestion-rows";

export interface PassFace {
  face: AdminPrintingResponse;
  model: FaceSuggestionModel;
  uploads: AdminPrintingImageResponse[];
  failedRehosts: AdminPrintingImageResponse[];
  pending: boolean;
}

export interface PassPrinting {
  printing: AdminPrintingResponse;
  model: PrintingSuggestionModel;
  pending: boolean;
}

export interface PassRow {
  entry: PassPrinting;
  faces: PassFace[];
  pending: boolean;
}

export interface PassDismiss {
  candidateCardIds: string[];
  candidatePrintingIds: string[];
  suggestions: number;
}

export interface CardPassModel {
  hiddenProviders: Set<string>;
  card: CardSuggestions;
  faces: PassFace[];
  printings: PassPrinting[];
  rows: PassRow[];
  dismiss: PassDismiss;
}

export function faceImageWork(model: FaceSuggestionModel): {
  uploads: AdminPrintingImageResponse[];
  failedRehosts: AdminPrintingImageResponse[];
  pending: boolean;
} {
  const uploads = model.images.filter(
    (image) => !image.isActive && !image.activateWhenRehosted && !image.isReviewed,
  );
  const failedRehosts = model.images.filter(
    (image) => !image.isActive && image.activateWhenRehosted && image.rehostFailure !== null,
  );
  return {
    uploads,
    failedRehosts,
    pending:
      model.suggestions.length > 0 ||
      model.sourceImages.length > 0 ||
      uploads.length > 0 ||
      failedRehosts.length > 0,
  };
}

function byRank(printings: readonly AdminPrintingResponse[]): AdminPrintingResponse[] {
  return printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank || a.side - b.side);
}

function firstBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

export function uniquePrintingsByRank(
  printings: readonly AdminPrintingResponse[],
): AdminPrintingResponse[] {
  return firstBy(byRank(printings), (row) => row.id);
}

export function buildCardPass(
  detail: AdminCardDetailResponse,
  options: {
    providerSettings: readonly ProviderSettingResponse[];
    submissions: readonly AttentionSubmission[];
    costKeywords: readonly string[];
    isAdmin: boolean;
  },
): CardPassModel {
  const hiddenProviders = hiddenProvidersFor(options.providerSettings, options.isAdmin);
  const context = {
    costKeywords: options.costKeywords,
    setTotals: detail.setTotals,
    hiddenProviders,
  };
  const visibleSources = detail.sources.filter((source) => !hiddenProviders.has(source.provider));
  const card = buildCardSuggestions({ ...detail, sources: visibleSources }, options.submissions);
  const ranked = byRank(detail.printings);

  const faces = firstBy(ranked, (row) => row.faceId).map((face): PassFace => {
    const model = buildFaceSuggestions(detail, face.faceId, context);
    return { face, model, ...faceImageWork(model) };
  });

  const printings = uniquePrintingsByRank(ranked).map((printing): PassPrinting => {
    const model = buildPrintingSuggestions([detail], printing.id, context);
    return { printing, model, pending: model.suggestions.length > 0 };
  });

  const facesById = new Map(faces.map((entry) => [entry.face.faceId, entry]));
  const rows = printings.map((entry): PassRow => {
    const onPrinting = ranked
      .filter((row) => row.id === entry.printing.id)
      .flatMap((row) => facesById.get(row.faceId) ?? []);
    const printingFaces = firstBy(onPrinting, (face) => face.face.faceId);
    return {
      entry,
      faces: printingFaces,
      pending: entry.pending || printingFaces.some((face) => face.pending),
    };
  });

  const printingDismiss = dismissTargets(
    [detail],
    [
      ...faces.flatMap((entry) => entry.model.sources),
      ...printings.flatMap((entry) => entry.model.sources),
    ],
    hiddenProviders,
  );
  const cardRows = card.enterTargets.filter((target) => target.differences > 0);

  return {
    hiddenProviders,
    card,
    faces,
    printings,
    rows,
    dismiss: {
      candidateCardIds: cardRows.map((target) => target.candidateRowId),
      candidatePrintingIds: printingDismiss.candidatePrintingIds,
      suggestions:
        cardRows.reduce((total, row) => total + row.differences, 0) + printingDismiss.suggestions,
    },
  };
}

export function dismissTargets(
  details: readonly AdminCardDetailResponse[],
  sources: readonly SuggestionSource[],
  hiddenProviders: ReadonlySet<string>,
): PassDismiss {
  const sourceRowIds = new Set(
    details
      .flatMap((detail) => detail.sources)
      .filter(
        (source) =>
          !hiddenProviders.has(source.provider) && source.provider !== USER_SUBMISSION_PROVIDER,
      )
      .map((source) => source.id),
  );
  const rows = sources.filter(
    (source) =>
      !source.isContributor && source.differences > 0 && sourceRowIds.has(source.candidateCardId),
  );
  return {
    candidateCardIds: [],
    candidatePrintingIds: [...new Set(rows.map((source) => source.candidatePrintingId))],
    suggestions: rows.reduce((total, row) => total + row.differences, 0),
  };
}

export function showsFaceOnStop(
  faceCardSlug: string,
  model: FaceSuggestionModel,
  reviewedCardSlug?: string,
): boolean {
  return model.face !== null && (reviewedCardSlug === faceCardSlug || faceImageWork(model).pending);
}

export interface PlacedNewPrintings<T> {
  after: Map<string | null, T[]>;
  ordered: T[];
}

export function placeNewPrintings<T extends { group: NewPrintingGroup }>(
  detail: AdminCardDetailResponse,
  shownRows: readonly PassRow[],
  newRows: readonly T[],
): PlacedNewPrintings<T> {
  const shownIds = new Set(shownRows.map((row) => row.entry.printing.id));
  const existing = uniquePrintingsByRank(detail.printings);
  const after = Map.groupBy(newRows, (row): string | null => {
    const [lead] = row.group.candidates;
    if (lead === undefined) {
      return null;
    }
    const match = closestPrintings(lead, existing).matches[0]?.printing.id;
    if (match !== undefined && shownIds.has(match)) {
      return match;
    }
    return (
      shownRows.findLast((entry) => entry.entry.printing.shortCode === lead.shortCode)?.entry
        .printing.id ?? null
    );
  });
  const ordered = [
    ...(after.get(null) ?? []),
    ...shownRows.flatMap((row) => after.get(row.entry.printing.id) ?? []),
  ];
  return { after, ordered };
}

export interface NewPrintingGroup {
  key: string;
  candidates: CandidatePrintingResponse[];
  providers: string[];
  hasContributor: boolean;
}

export function newPrintingGroups(
  detail: AdminCardDetailResponse,
  hiddenProviders: ReadonlySet<string>,
): NewPrintingGroup[] {
  const sourceIds = new Set(
    detail.sources
      .filter((source) => !hiddenProviders.has(source.provider))
      .map((source) => source.id),
  );
  const visible = (candidate: CandidatePrintingResponse) =>
    candidate.printingId === null && sourceIds.has(candidate.candidateCardId);
  const seen = new Set<string>();
  const groups: NewPrintingGroup[] = [];
  for (const candidate of detail.candidatePrintings) {
    if (!visible(candidate) || seen.has(candidate.id)) {
      continue;
    }
    const members = unlinkedGroupCandidates(detail, candidate.id).filter((member) =>
      visible(member),
    );
    const candidates = members.length === 0 ? [candidate] : members;
    for (const member of candidates) {
      seen.add(member.id);
    }
    const providers = [
      ...new Set(candidates.map((member) => providerOf(detail, member.candidateCardId))),
    ];
    groups.push({
      key: candidate.id,
      candidates,
      providers,
      hasContributor: providers.includes(USER_SUBMISSION_PROVIDER),
    });
  }
  return groups;
}

export function seededPrintingDraft(
  detail: AdminCardDetailResponse,
  group: NewPrintingGroup,
  setReleaseYears: SetReleaseYears,
  favoriteProviders: ReadonlySet<string>,
): { draft: CreationDraft | null; ready: boolean } {
  const card = detail.card;
  const [lead] = group.candidates;
  if (card === null || lead === undefined) {
    return { draft: null, ready: false };
  }
  const provider = providerOf(detail, lead.candidateCardId);
  const draft = {
    ...draftFromCandidatePrinting(
      { mode: "existing", id: card.id, slug: card.slug, name: detail.displayName },
      lead,
      provider,
      setReleaseYears,
      favoriteProviders.has(provider),
    ),
    candidatePrintingIds: group.candidates.map((candidate) => candidate.id),
  };
  const existing = firstBy(detail.printings, (row) => row.id);
  const duplicates = findDuplicateCandidates(
    draft,
    existing.map((printing) => duplicateProbeFromAdminPrinting(printing)),
  );
  return {
    draft,
    ready: !group.hasContributor && validateDraft(draft).length === 0 && duplicates.length === 0,
  };
}

/** Where an image came from: the source that listed its URL, the URL's host, or an upload. */
export function imageOrigin(
  detail: AdminCardDetailResponse,
  image: Pick<AdminPrintingImageResponse, "originalUrl" | "uploadedByName">,
): string {
  const url = image.originalUrl;
  if (url === null || !isWebUrl(url)) {
    return image.uploadedByName === null ? "Uploaded" : `Uploaded by ${image.uploadedByName}`;
  }
  const listed = detail.candidatePrintings.find((candidate) => candidate.imageUrl === url);
  if (listed !== undefined) {
    return `From ${providerOf(detail, listed.candidateCardId)}`;
  }
  return `From ${URL.canParse(url) ? new URL(url).hostname : url}`;
}

export function isWebUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

interface PassContributor {
  name: string;
  note: string | null;
  otherChanges: number;
}

export function passContributor(
  detail: AdminCardDetailResponse,
  submissions: readonly AttentionSubmission[],
  candidateCardId: string,
): PassContributor {
  const source = detail.sources.find((entry) => entry.id === candidateCardId);
  const submission = submissions.find((entry) => entry.candidateCardId === candidateCardId);
  return {
    name: source?.submittedByName ?? submission?.submitterName ?? "Contributor",
    note: source?.submissionNote ?? submission?.note ?? null,
    otherChanges: submission === undefined ? 0 : Math.max(0, submissionChangeCount(submission) - 1),
  };
}
