import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type { AcceptPrintingBody } from "@openrift/shared/contracts/admin/card-mutations";
import type {
  DeskCreateInput,
  DeskPrintingRow,
  DeskReleasePrecision,
  DeskUpdateInput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { extractCardIdFromShortCode, isTbaCode } from "@openrift/shared/printing-code";
import { normalizeToPeriodStart } from "@openrift/shared/set-release";
import type {
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import { buildPrintingFieldsFromCandidate } from "@/features/admin/lib/printing-fields";

export interface DraftFaceFields {
  shortCode: string;
  codeTba: boolean;
  publicCode: string;
  setId: string;
  setSlug: string;
  setName: string | null;
  language: string;
  finish: string;
  rarity: string;
  artVariant: string;
  isSigned: boolean;
  artist: string;
  markerSlugs: string[];
  printedName: string | null;
  printedRulesText: string | null;
  printedEffectText: string | null;
  flavorText: string | null;
}

export type DraftImage =
  | { kind: "file"; key: string; file: File }
  | { kind: "source"; key: string; url: string; label: string };

export type DraftFace =
  | { mode: "new"; fields: DraftFaceFields; images: DraftImage[] }
  | {
      mode: "existing";
      faceId: string;
      label: string;
      cardSlug: string;
      printingId: string;
      fields: DraftFaceFields;
      images: DraftImage[];
    };

export type ExistingDraftFace = Extract<DraftFace, { mode: "existing" }>;

export type DraftCard =
  | { mode: "existing"; id: string; slug: string; name: string; note?: string }
  | { mode: "new"; slug: string; name: string; summary: string };

export interface DraftPrintingFields {
  distributionChannelSlugs: string[];
  size: string;
  announcedAt: string | null;
  releasedAt: string | null;
  releasePrecision: DeskReleasePrecision;
  comment: string;
}

type CreationTarget = "desk" | "accept";

export interface CreationDraft {
  target: CreationTarget;
  card: DraftCard | null;
  faces: DraftFace[];
  printing: DraftPrintingFields;
  basePrintingId?: string;
  candidatePrintingIds: string[];
}

export interface DraftIssue {
  path: string;
  message: string;
}

export interface DuplicateProbe {
  printingId: string;
  cardId: string;
  side?: 1 | 2;
  shortCode: string;
  publicCode: string;
  language: string;
  finish: string;
  size: string;
  markerSlugs: readonly string[];
  distributionChannelSlugs: readonly string[];
}

export interface DuplicateCandidate {
  printingId: string;
  shortCode: string;
  publicCode: string;
  language: string;
  finish: string;
  distributionChannelSlugs: string[];
  kind: "same-language" | "other-language";
  identical: boolean;
}

export interface PlannedImageUpload {
  faceIndex: number;
  face: "front" | "back";
  mode: "main" | "additional";
  image: DraftImage;
}

export const MAX_DRAFT_FACES = 2;

export function emptyFaceFields(defaults: Partial<DraftFaceFields> = {}): DraftFaceFields {
  return {
    shortCode: "",
    codeTba: false,
    publicCode: "",
    setId: "",
    setSlug: "",
    setName: null,
    language: "",
    finish: "",
    rarity: "",
    artVariant: "",
    isSigned: false,
    artist: "",
    markerSlugs: [],
    printedName: null,
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    ...defaults,
  };
}

function emptyPrintingFields(defaults: Partial<DraftPrintingFields> = {}): DraftPrintingFields {
  return {
    distributionChannelSlugs: [],
    size: "",
    announcedAt: null,
    releasedAt: null,
    releasePrecision: "day",
    comment: "",
    ...defaults,
  };
}

function emptyDraft(target: CreationTarget = "desk"): CreationDraft {
  return {
    target,
    card: null,
    faces: [{ mode: "new", fields: emptyFaceFields(), images: [] }],
    printing: emptyPrintingFields(),
    candidatePrintingIds: [],
  };
}

function faceFieldsFromDeskRow(row: DeskPrintingRow): DraftFaceFields {
  const codeTba = isTbaCode(row.publicCode);
  return emptyFaceFields({
    shortCode: row.shortCode,
    codeTba,
    publicCode: row.publicCode,
    setId: row.setId,
    setSlug: row.setSlug,
    setName: row.setName,
    language: row.language,
    finish: row.finish,
    rarity: row.rarity,
    artist: row.artist,
    markerSlugs: [...row.markerSlugs],
  });
}

function faceLabel(fields: DraftFaceFields): string {
  const code = fields.codeTba ? "Code TBA" : fields.shortCode;
  return [code, fields.language, fields.finish].filter((part) => part.length > 0).join(" · ");
}

function existingFaceFromDeskRow(row: DeskPrintingRow): ExistingDraftFace {
  const fields = faceFieldsFromDeskRow(row);
  return {
    mode: "existing",
    faceId: row.faceId,
    label: `${row.cardName} · ${faceLabel(fields)}`,
    cardSlug: row.cardSlug,
    printingId: row.printingId,
    fields,
    images: [],
  };
}

export function existingFacesFromDeskRows(rows: readonly DeskPrintingRow[]): ExistingDraftFace[] {
  const faces = new Map<string, ExistingDraftFace>();
  for (const row of rows) {
    if (!faces.has(row.faceId)) {
      faces.set(row.faceId, existingFaceFromDeskRow(row));
    }
    const second = row.secondSide;
    if (second && !faces.has(second.faceId)) {
      const fields = emptyFaceFields({
        shortCode: second.shortCode,
        codeTba: isTbaCode(second.publicCode),
        publicCode: second.publicCode,
        setId: second.setId,
        setName: second.setName,
        language: second.language,
        finish: second.finish,
        rarity: second.rarity,
        artist: second.artist,
        markerSlugs: [...second.markerSlugs],
      });
      faces.set(second.faceId, {
        mode: "existing",
        faceId: second.faceId,
        label: `${second.cardName} · ${faceLabel(fields)}`,
        cardSlug: second.cardSlug,
        printingId: row.printingId,
        fields,
        images: [],
      });
    }
  }
  return [...faces.values()];
}

export function faceToNew(face: DraftFace): DraftFace {
  return { mode: "new", fields: { ...face.fields }, images: face.images };
}

export function draftFromBasePrinting(
  card: { id: string; slug: string; name: string },
  base: DeskPrintingRow | undefined,
  defaults: { language: string; finish: string; size: string },
): CreationDraft {
  const fields = base
    ? {
        ...faceFieldsFromDeskRow(base),
        shortCode: "",
        codeTba: false,
        publicCode: "",
        markerSlugs: [],
      }
    : emptyFaceFields({ language: defaults.language, finish: defaults.finish });
  return {
    target: "desk",
    card: { mode: "existing", ...card },
    faces: [{ mode: "new", fields: { ...fields, language: defaults.language }, images: [] }],
    printing: emptyPrintingFields({ size: base?.size ?? defaults.size }),
    basePrintingId: base?.printingId,
    candidatePrintingIds: [],
  };
}

export function draftFromDeskPrinting(
  card: { id: string; slug: string; name: string },
  printing: DeskPrintingRow,
): CreationDraft {
  const faces: DraftFace[] = [existingFaceFromDeskRow(printing)];
  const second = printing.secondSide;
  if (second) {
    const secondFace = existingFacesFromDeskRows([printing]).find(
      (face) => face.faceId === second.faceId,
    );
    if (secondFace) {
      faces.push(secondFace);
    }
  }
  return {
    target: "desk",
    card: { mode: "existing", ...card },
    faces,
    printing: emptyPrintingFields({
      distributionChannelSlugs: [...printing.distributionChannelSlugs],
      size: printing.size,
      announcedAt: printing.announcedAt,
      releasedAt: printing.releasedAt,
      releasePrecision: printing.releasePrecision ?? "day",
      comment: printing.comment ?? "",
    }),
    basePrintingId: printing.printingId,
    candidatePrintingIds: [],
  };
}

function faceFieldsFromCandidate(candidate: CandidatePrintingResponse): DraftFaceFields {
  const fields = buildPrintingFieldsFromCandidate(candidate);
  return emptyFaceFields({
    shortCode: fields.shortCode,
    codeTba: false,
    publicCode: fields.publicCode,
    setSlug: fields.setId ?? "",
    setName: fields.setName ?? null,
    language: fields.language ?? "",
    finish: fields.finish ?? "",
    rarity: fields.rarity ?? "",
    artVariant: fields.artVariant ?? "",
    isSigned: fields.isSigned ?? false,
    artist: fields.artist,
    markerSlugs: [...(fields.markerSlugs ?? [])],
    printedName: fields.printedName ?? null,
    printedRulesText: fields.printedRulesText ?? null,
    printedEffectText: fields.printedEffectText ?? null,
    flavorText: fields.flavorText ?? null,
  });
}

export function draftFromCandidatePrinting(
  card: DraftCard,
  candidate: CandidatePrintingResponse,
  sourceLabel: string,
): CreationDraft {
  const images: DraftImage[] = hasFieldValue(candidate.imageUrl)
    ? [
        {
          kind: "source",
          key: `source:${candidate.id}`,
          url: candidate.imageUrl as string,
          label: `${sourceLabel} scan`,
        },
      ]
    : [];
  return {
    target: "accept",
    card,
    faces: [{ mode: "new", fields: faceFieldsFromCandidate(candidate), images }],
    printing: emptyPrintingFields({
      distributionChannelSlugs: [...candidate.distributionChannelSlugs],
      size: candidate.size ?? "",
    }),
    candidatePrintingIds: [candidate.id],
  };
}

export function draftFromNewCard(
  card: { slug: string; name: string; summary: string },
  candidate: CandidatePrintingResponse | undefined,
  sourceLabel: string,
): CreationDraft {
  const newCard: DraftCard = { mode: "new", ...card };
  if (!candidate) {
    return { ...emptyDraft("accept"), card: newCard };
  }
  return draftFromCandidatePrinting(newCard, candidate, sourceLabel);
}

function faceIssues(face: DraftFace, index: number, draft: CreationDraft): DraftIssue[] {
  const path = `faces.${index}`;
  if (face.mode === "existing") {
    if (index === 0 && draft.card?.mode === "existing" && face.cardSlug !== draft.card.slug) {
      return [{ path, message: "The first face must belong to this card." }];
    }
    return [];
  }
  if (index > 0) {
    return [{ path, message: "Pick an existing face for the second face." }];
  }
  const { fields } = face;
  const issues: DraftIssue[] = [];
  const setKnown = draft.target === "desk" ? fields.setId.length > 0 : fields.setSlug.length > 0;
  if (!setKnown) {
    issues.push({ path: `${path}.set`, message: "Pick a set." });
  }
  if (!fields.codeTba && fields.shortCode.trim().length === 0) {
    issues.push({ path: `${path}.shortCode`, message: "Enter the card code." });
  }
  if (fields.language.length === 0) {
    issues.push({ path: `${path}.language`, message: "Pick a language." });
  }
  if (fields.finish.length === 0) {
    issues.push({ path: `${path}.finish`, message: "Pick a finish." });
  }
  const artistOptional = draft.target === "desk" && draft.basePrintingId !== undefined;
  if (!artistOptional && fields.artist.trim().length === 0) {
    issues.push({ path: `${path}.artist`, message: "Enter the artist." });
  }
  if (draft.target === "accept" && fields.publicCode.trim().length === 0 && !fields.codeTba) {
    issues.push({ path: `${path}.publicCode`, message: "Enter the public code." });
  }
  return issues;
}

export function validateDraft(draft: CreationDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (draft.card === null) {
    issues.push({ path: "card", message: "Pick the card." });
  } else if (draft.target === "desk" && draft.card.mode !== "existing") {
    issues.push({ path: "card", message: "The printing desk adds printings to existing cards." });
  }
  if (draft.faces.length === 0) {
    issues.push({ path: "faces", message: "Add a face." });
  }
  if (draft.faces.length > MAX_DRAFT_FACES) {
    issues.push({ path: "faces", message: "A printing has at most two faces." });
  }
  const [first, second] = draft.faces;
  if (first?.mode === "existing" && second?.mode === "existing" && first.faceId === second.faceId) {
    issues.push({ path: "faces.1", message: "The two faces must be different." });
  }
  for (const [index, face] of draft.faces.entries()) {
    issues.push(...faceIssues(face, index, draft));
  }
  if (draft.printing.size.length === 0) {
    issues.push({ path: "printing.size", message: "Pick a size." });
  }
  return issues;
}

function codeStem(shortCode: string): string {
  return extractCardIdFromShortCode(shortCode.split("/")[0]?.trim() ?? "").toUpperCase();
}

function sameSlugSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedB = b.toSorted();
  return a.toSorted().every((slug, index) => slug === sortedB[index]);
}

export function duplicateProbeFromDeskRow(row: DeskPrintingRow): DuplicateProbe {
  return {
    printingId: row.printingId,
    cardId: row.cardId,
    side: row.side,
    shortCode: row.shortCode,
    publicCode: row.publicCode,
    language: row.language,
    finish: row.finish,
    size: row.size,
    markerSlugs: row.markerSlugs,
    distributionChannelSlugs: row.distributionChannelSlugs,
  };
}

export function duplicateProbeFromAdminPrinting(printing: AdminPrintingResponse): DuplicateProbe {
  return {
    printingId: printing.id,
    cardId: printing.cardId,
    side: printing.side === 2 ? 2 : 1,
    shortCode: printing.shortCode,
    publicCode: printing.publicCode,
    language: printing.language,
    finish: printing.finish,
    size: printing.size,
    markerSlugs: printing.markerSlugs,
    distributionChannelSlugs: printing.distributionChannelSlugs,
  };
}

/**
 * Same card, code stem and channels, or the same identity the server rejects as a conflict
 * whatever the channels. A different language is listed apart: it is a separate printing.
 */
export function findDuplicateCandidates(
  draft: CreationDraft,
  existingPrintings: readonly DuplicateProbe[],
): DuplicateCandidate[] {
  const face = draft.faces.at(0);
  if (!face || face.fields.codeTba || draft.card?.mode !== "existing") {
    return [];
  }
  const cardId = draft.card.id;
  const stem = codeStem(face.fields.shortCode);
  if (stem.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const hits: DuplicateCandidate[] = [];
  for (const probe of existingPrintings) {
    if (
      seen.has(probe.printingId) ||
      probe.side === 2 ||
      probe.cardId !== cardId ||
      codeStem(probe.shortCode) !== stem
    ) {
      continue;
    }
    const sameLanguage = probe.language === face.fields.language;
    const identical =
      sameLanguage &&
      probe.shortCode.toUpperCase() === face.fields.shortCode.trim().toUpperCase() &&
      probe.finish === face.fields.finish &&
      probe.size === draft.printing.size &&
      sameSlugSet(probe.markerSlugs, face.fields.markerSlugs);
    if (
      !identical &&
      !sameSlugSet(probe.distributionChannelSlugs, draft.printing.distributionChannelSlugs)
    ) {
      continue;
    }
    seen.add(probe.printingId);
    hits.push({
      printingId: probe.printingId,
      shortCode: probe.shortCode,
      publicCode: probe.publicCode,
      language: probe.language,
      finish: probe.finish,
      distributionChannelSlugs: [...probe.distributionChannelSlugs],
      kind: sameLanguage ? "same-language" : "other-language",
      identical,
    });
  }
  return hits.toSorted(
    (a, b) =>
      Number(b.kind === "same-language") - Number(a.kind === "same-language") ||
      Number(b.identical) - Number(a.identical),
  );
}

function releaseFields(printing: DraftPrintingFields) {
  return printing.releasedAt
    ? normalizeToPeriodStart({
        releasedAt: printing.releasedAt,
        precision: printing.releasePrecision,
      })
    : { releasedAt: null, precision: null };
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function secondSideFaceId(draft: CreationDraft): string | undefined {
  const second = draft.faces.at(1);
  return second?.mode === "existing" ? second.faceId : undefined;
}

function requireFirstFace(draft: CreationDraft): DraftFace {
  const face = draft.faces.at(0);
  if (!face) {
    throw new Error("The draft has no face.");
  }
  return face;
}

export function toDeskCreateInput(draft: CreationDraft): DeskCreateInput {
  if (draft.card?.mode !== "existing") {
    throw new Error("The printing desk needs an existing card.");
  }
  const face = requireFirstFace(draft);
  const { fields } = face;
  const release = releaseFields(draft.printing);
  const artist = fields.artist.trim();
  const basePrintingId = face.mode === "existing" ? face.printingId : draft.basePrintingId;
  return {
    cardId: draft.card.id,
    setId: fields.setId,
    distributionChannelSlugs: [...draft.printing.distributionChannelSlugs],
    markerSlugs: [...fields.markerSlugs],
    codeTba: fields.codeTba,
    shortCode: fields.codeTba ? undefined : fields.shortCode.trim(),
    finish: fields.finish,
    language: fields.language,
    size: draft.printing.size,
    artist: artist.length > 0 ? artist : undefined,
    announcedAt: draft.printing.announcedAt,
    releasedAt: release.releasedAt,
    releasePrecision: release.precision as DeskReleasePrecision | null,
    comment: trimmedOrNull(draft.printing.comment),
    basePrintingId,
    secondSideFaceId: secondSideFaceId(draft),
  };
}

export interface AcceptInput {
  cardId: string;
  printingFields: AcceptPrintingBody["printingFields"];
  candidatePrintingIds: string[];
  secondSideFaceId?: string;
}

export function toAcceptInput(draft: CreationDraft, cardId?: string): AcceptInput {
  const resolvedCardId = cardId ?? (draft.card?.mode === "existing" ? draft.card.id : undefined);
  if (resolvedCardId === undefined) {
    throw new Error("The accept path needs the card id.");
  }
  const face = requireFirstFace(draft);
  const { fields } = face;
  const shortCode = fields.shortCode.trim();
  const sourceImage = face.images.find((image) => image.kind === "source");
  const printingFields: AcceptPrintingBody["printingFields"] = {
    shortCode,
    publicCode: fields.publicCode.trim().length > 0 ? fields.publicCode.trim() : shortCode,
    artist: fields.artist.trim(),
    markerSlugs: [...fields.markerSlugs],
    distributionChannelSlugs: [...draft.printing.distributionChannelSlugs],
    isSigned: fields.isSigned,
  };
  if (fields.setSlug.length > 0) {
    printingFields.setId = fields.setSlug;
  }
  if (fields.setName !== null) {
    printingFields.setName = fields.setName;
  }
  const optional = {
    rarity: fields.rarity,
    artVariant: fields.artVariant,
    finish: fields.finish,
    size: draft.printing.size,
    language: fields.language,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value.length > 0) {
      printingFields[key as keyof typeof optional] = value;
    }
  }
  if (fields.printedName !== null) {
    printingFields.printedName = fields.printedName;
  }
  if (fields.printedRulesText !== null) {
    printingFields.printedRulesText = fields.printedRulesText;
  }
  if (fields.printedEffectText !== null) {
    printingFields.printedEffectText = fields.printedEffectText;
  }
  if (fields.flavorText !== null) {
    printingFields.flavorText = fields.flavorText;
  }
  if (sourceImage?.kind === "source") {
    printingFields.imageUrl = sourceImage.url;
  }
  const second = secondSideFaceId(draft);
  return {
    cardId: resolvedCardId,
    printingFields,
    candidatePrintingIds: [...draft.candidatePrintingIds],
    ...(second === undefined ? {} : { secondSideFaceId: second }),
  };
}

/** The accept path does not write dates or the note; these go through a desk update after it. */
export function printingFollowUpFields(
  draft: CreationDraft,
): Pick<DeskUpdateInput, "announcedAt" | "releasedAt" | "releasePrecision" | "comment"> | null {
  const release = releaseFields(draft.printing);
  const comment = trimmedOrNull(draft.printing.comment);
  if (draft.printing.announcedAt === null && release.releasedAt === null && comment === null) {
    return null;
  }
  return {
    announcedAt: draft.printing.announcedAt,
    releasedAt: release.releasedAt,
    releasePrecision: release.precision as DeskReleasePrecision | null,
    comment,
  };
}

export function plannedImageUploads(draft: CreationDraft): PlannedImageUpload[] {
  return draft.faces.flatMap((face, faceIndex) => {
    const ridesAlong =
      draft.target === "accept" && faceIndex === 0
        ? face.images.find((image) => image.kind === "source")
        : undefined;
    const images = face.images.filter((image) => image !== ridesAlong);
    const hasActive = face.mode === "existing" || ridesAlong !== undefined;
    return images.map((image, index) => ({
      faceIndex,
      face: faceIndex === 0 ? ("front" as const) : ("back" as const),
      mode: index === 0 && !hasActive ? ("main" as const) : ("additional" as const),
      image,
    }));
  });
}

export function updateFace(draft: CreationDraft, index: number, face: DraftFace): CreationDraft {
  return { ...draft, faces: draft.faces.map((current, i) => (i === index ? face : current)) };
}

export function removeFace(draft: CreationDraft, index: number): CreationDraft {
  return { ...draft, faces: draft.faces.filter((_, i) => i !== index) };
}
