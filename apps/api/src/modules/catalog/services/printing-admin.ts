import { ERROR_CODES } from "@openrift/shared/error-codes";
import { appendSetTotal, fixTypography } from "@openrift/shared/fix-typography";
import type { RequiredAcceptPrintingField } from "@openrift/shared/printing-accept";
import { REQUIRED_ACCEPT_PRINTING_FIELDS, resolveFinish } from "@openrift/shared/printing-accept";
import { trimToNull } from "@openrift/shared/strings";
import type { ArtVariant, CardSize, Finish, Rarity } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { assertFound } from "../../../lib/assertions.js";
import { isForeignKeyViolation, isUniqueViolationOn } from "../../../lib/pg-errors.js";
import { candidateAcceptKey } from "../../candidates/lib/candidate-printing-accept.js";
import type { candidateCardsRepo } from "../../candidates/repositories/candidate-cards.js";
import { faceForNewImage } from "../lib/image-face.js";
import {
  describeUnknownRefs,
  knownRarity,
  loadKnownPrintingRefs,
  unknownPrintingRefs,
} from "../lib/printing-refs.js";
import type {
  catalogDeleteGuardsRepo,
  PrintingDeleteBlockers,
} from "../repositories/catalog-delete-guards.js";
import type {
  catalogMutationsRepo,
  FacePrintedFields,
  PrintingIdentity,
} from "../repositories/catalog-mutations.js";
import type { distributionChannelsRepo } from "../repositories/distribution-channels.js";
import { deleteRehostFiles } from "./images/variants.js";

type CatalogMutationsRepo = ReturnType<typeof catalogMutationsRepo>;
type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;
type CatalogDeleteGuardsRepo = ReturnType<typeof catalogDeleteGuardsRepo>;
type DistributionChannelsRepo = ReturnType<typeof distributionChannelsRepo>;

/**
 * Runs inside a transaction so the sync trigger's intermediate empty state
 * only has to satisfy the deferrable uniqueness checks at commit time.
 */
export async function updatePrintingMarkers(
  transact: Transact,
  printingId: string,
  newSlugs: readonly string[],
  side: 1 | 2 = 1,
): Promise<void> {
  await transact(async (trxRepos) => {
    const printing = await trxRepos.catalogMutations.getPrintingById(printingId);
    assertFound(printing, "Printing not found");

    if (newSlugs.length === 0) {
      await trxRepos.markers.setForPrinting(printingId, [], side);
      return;
    }

    const markerRows = await trxRepos.markers.listBySlugs(newSlugs);
    const known = new Set(markerRows.map((m) => m.slug));
    const missing = newSlugs.filter((s) => !known.has(s));
    if (missing.length > 0) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        `Unknown marker slug(s): ${missing.join(", ")}`,
      );
    }

    await trxRepos.markers.setForPrinting(
      printingId,
      markerRows.map((m) => m.id),
      side,
    );
  });
}

export async function updatePrintingDistributionChannels(
  repos: {
    catalogMutations: CatalogMutationsRepo;
    distributionChannels: DistributionChannelsRepo;
  },
  printingId: string,
  newSlugs: readonly string[],
): Promise<void> {
  const printing = await repos.catalogMutations.getPrintingById(printingId);
  assertFound(printing, "Printing not found");

  if (newSlugs.length === 0) {
    await repos.distributionChannels.setForPrinting(printingId, []);
    return;
  }

  const channelRows = await repos.distributionChannels.listBySlugs(newSlugs);
  const known = new Set(channelRows.map((c) => c.slug));
  const missing = newSlugs.filter((s) => !known.has(s));
  if (missing.length > 0) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      `Unknown distribution channel slug(s): ${missing.join(", ")}`,
    );
  }

  await repos.distributionChannels.setForPrinting(
    printingId,
    channelRows.map((c) => ({ channelId: c.id })),
  );
}

export async function deletePrintingRows(
  trxRepos: { catalogMutations: CatalogMutationsRepo; candidateCards: CandidateCardsRepo },
  printingId: string,
): Promise<string[]> {
  await trxRepos.candidateCards.unlinkCandidatePrintingsByPrintingId(printingId);
  const images = await trxRepos.catalogMutations.deletePrintingImagesByPrintingId(printingId);
  await trxRepos.candidateCards.deletePrintingLinkOverridesById(printingId);
  await trxRepos.catalogMutations.deletePrintingById(printingId);
  return images.map((img) => img.imageFileId);
}

/**
 * Runs outside the deleting transaction: rehost deletion touches external
 * storage and must only happen after the DB delete is committed.
 */
export async function cleanupOrphanedImageFiles(
  io: Io,
  mut: CatalogMutationsRepo,
  imageFileIds: string[],
): Promise<void> {
  for (const imageFileId of imageFileIds) {
    const imageFile = await mut.getImageFileById(imageFileId);
    if (!imageFile) {
      continue;
    }
    const stillReferenced = await mut.isImageFileReferenced(imageFileId);
    if (!stillReferenced) {
      if (imageFile.rehostedUrl) {
        await deleteRehostFiles(io, imageFile.rehostedUrl);
      }
      await mut.deleteImageFileById(imageFileId);
    }
  }
}

const PRINTING_BLOCKER_LABELS: Record<keyof PrintingDeleteBlockers, string> = {
  copies: "collection copies",
  collectionEvents: "collection history entries",
  listEntries: "list entries",
  loans: "loans",
  cardTrades: "trades",
  marketplaceProductVariants: "marketplace variant mappings",
  productPrintings: "marketplace product mappings",
};

function throwIfPrintingBlocked(blockers: PrintingDeleteBlockers): void {
  const blocking = Object.entries(blockers).filter(([, count]) => count > 0);
  if (blocking.length > 0) {
    const detail = blocking
      .map(
        ([source, count]) =>
          `${PRINTING_BLOCKER_LABELS[source as keyof PrintingDeleteBlockers]} (${count})`,
      )
      .join(", ");
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      `Printing cannot be deleted, it is still referenced by: ${detail}`,
    );
  }
}

export async function deletePrinting(
  transact: Transact,
  io: Io,
  repos: { catalogMutations: CatalogMutationsRepo; catalogDeleteGuards: CatalogDeleteGuardsRepo },
  printingId: string,
): Promise<void> {
  const mut = repos.catalogMutations;
  const guards = repos.catalogDeleteGuards;

  const printing = await mut.getPrintingById(printingId);
  assertFound(printing, "Printing not found");

  throwIfPrintingBlocked(await guards.countForPrinting(printing.id));

  let deletedImageFileIds: string[];
  try {
    deletedImageFileIds = await transact((trxRepos) => deletePrintingRows(trxRepos, printing.id));
  } catch (error: unknown) {
    // 23503 foreign_key_violation: a row appeared between the blocker check
    // and the delete; re-check so the client still gets a clean CONFLICT.
    if (isForeignKeyViolation(error)) {
      throwIfPrintingBlocked(await guards.countForPrinting(printing.id));
    }
    throw error;
  }

  await cleanupOrphanedImageFiles(io, mut, deletedImageFileIds);
}

interface NewPrintingFields {
  shortCode: string;
  setId?: string;
  setName?: string | null;
  rarity: string;
  artVariant?: string;
  isSigned?: boolean;
  isOvernumbered?: boolean;
  markerSlugs?: string[];
  distributionChannelSlugs?: string[];
  finish?: string;
  size?: string;
  artist: string;
  publicCode: string;
  printedRulesText?: string | null;
  printedEffectText?: string | null;
  flavorText?: string | null;
  imageUrl?: string | null;
  language?: string;
  printedName?: string | null;
  printedYear?: number | null;
}

type NewPrintingRepos = Pick<
  Repos,
  | "catalogMutations"
  | "candidateCards"
  | "cardTokens"
  | "distributionChannels"
  | "enums"
  | "keywords"
  | "printingImages"
  | "sets"
>;

export interface NewPrinting {
  printingId: string;
  imageIds: string[];
}

export function newPrintingIdentity(cardId: string, fields: NewPrintingFields): PrintingIdentity {
  return {
    cardId,
    shortCode: fields.shortCode,
    finish: (resolveFinish(fields.finish, fields.rarity) ?? "") as Finish,
    size: (fields.size ?? WellKnown.cardSize.STANDARD) as CardSize,
    markerSlugs: [...(fields.markerSlugs ?? [])].sort(),
    language: fields.language ?? WellKnown.language.EN,
  };
}

type FaceCheckRepos = Pick<Repos, "catalogMutations" | "sets" | "keywords">;

async function printedFaceValues(
  repos: FaceCheckRepos,
  printingFields: NewPrintingFields,
  rarity: string,
  artist: string,
): Promise<Omit<FacePrintedFields, "setId"> & { setId: string }> {
  const setRow = printingFields.setId
    ? await repos.catalogMutations.getSetIdBySlug(printingFields.setId)
    : undefined;
  const setId = setRow?.id ?? "";
  const setTotalRow = setId ? await repos.sets.getPrintedTotal(setId) : null;
  const costKeywords = await repos.keywords.listCostKeywords();
  return {
    setId,
    rarity: rarity as Rarity,
    artVariant: (printingFields.artVariant ?? WellKnown.artVariant.NORMAL) as ArtVariant,
    isSigned: printingFields.isSigned ?? false,
    isOvernumbered: printingFields.isOvernumbered ?? false,
    artist,
    publicCode: appendSetTotal(printingFields.publicCode, setTotalRow?.printedTotal ?? null),
    printedRulesText: fixTypography(trimToNull(printingFields.printedRulesText), {
      costKeywords,
    }),
    printedEffectText: fixTypography(trimToNull(printingFields.printedEffectText), {
      costKeywords,
    }),
    flavorText: fixTypography(trimToNull(printingFields.flavorText), {
      italicParens: false,
      keywordGlyphs: false,
    }),
    printedName: trimToNull(printingFields.printedName),
    printedYear: printingFields.printedYear ?? null,
  };
}

// Art variant, signed and overnumbered fall back to their defaults upstream, so a
// default value is "not stated" and never conflicts; neither does a missing text.
const PRINTED_FACE_FIELD_CHECKS: {
  label: string;
  differs: (stored: FacePrintedFields, incoming: FacePrintedFields) => boolean;
}[] = [
  { label: "set", differs: (a, b) => a.setId !== b.setId },
  { label: "rarity", differs: (a, b) => a.rarity.toLowerCase() !== b.rarity.toLowerCase() },
  {
    label: "art variant",
    differs: (a, b) =>
      b.artVariant !== WellKnown.artVariant.NORMAL && a.artVariant !== b.artVariant,
  },
  { label: "signed", differs: (a, b) => b.isSigned && !a.isSigned },
  { label: "overnumbered", differs: (a, b) => b.isOvernumbered && !a.isOvernumbered },
  { label: "artist", differs: (a, b) => a.artist !== b.artist },
  { label: "public code", differs: (a, b) => a.publicCode !== b.publicCode },
  ...(
    [
      ["rules text", "printedRulesText"],
      ["effect text", "printedEffectText"],
      ["flavor text", "flavorText"],
      ["printed name", "printedName"],
      ["printed year", "printedYear"],
    ] as const
  ).map(([label, field]) => ({
    label,
    differs: (a: FacePrintedFields, b: FacePrintedFields) =>
      b[field] !== null && a[field] !== b[field],
  })),
];

export async function facePrintedFieldConflict(
  repos: FaceCheckRepos,
  cardId: string,
  printingFields: NewPrintingFields,
): Promise<string | null> {
  const { size: _size, ...faceIdentity } = newPrintingIdentity(cardId, printingFields);
  const face = await repos.catalogMutations.findFaceIdByIdentity(faceIdentity);
  if (!face) {
    return null;
  }
  const stored = await repos.catalogMutations.getFacePrintedFields(face.id);
  if (!stored) {
    return null;
  }
  const incoming = await printedFaceValues(
    repos,
    printingFields,
    printingFields.rarity,
    trimToNull(printingFields.artist) ?? "",
  );
  const trimmedStored: FacePrintedFields = {
    ...stored,
    artist: stored.artist.trim(),
    publicCode: stored.publicCode.trim(),
    printedRulesText: trimToNull(stored.printedRulesText),
    printedEffectText: trimToNull(stored.printedEffectText),
    flavorText: trimToNull(stored.flavorText),
    printedName: trimToNull(stored.printedName),
  };
  const differing = PRINTED_FACE_FIELD_CHECKS.filter((check) =>
    check.differs(trimmedStored, incoming),
  );
  if (differing.length === 0) {
    return null;
  }
  const { shortCode, finish, language } = faceIdentity;
  return `The existing ${shortCode} ${finish} ${language} side differs in ${differing.map((check) => check.label).join(", ")}. Edit that side or the source first.`;
}

export async function newPrintingConflict(
  repos: Pick<Repos, "catalogMutations">,
  identity: PrintingIdentity,
  secondFaceId: string | null = null,
): Promise<string | null> {
  const { cardId, shortCode, finish, markerSlugs, language } = identity;
  const owner = await repos.catalogMutations.getPrintingCardIdByComposite(
    shortCode,
    finish,
    markerSlugs,
    language,
  );
  if (owner && owner.cardId !== cardId) {
    return `Printing "${shortCode}:${finish}:${language}" already belongs to a different card`;
  }
  const identical = await repos.catalogMutations.findPrintingIdByIdentity(identity, secondFaceId);
  return identical ? existingPrintingMessage(identity) : null;
}

function existingPrintingMessage(identity: PrintingIdentity): string {
  const { shortCode, finish, size, markerSlugs, language } = identity;
  const markerPart = markerSlugs.length > 0 ? markerSlugs.join("+") : "no markers";
  return `This card already has a printing with short code "${shortCode}" (${finish}, ${size}, ${language}, ${markerPart}). Change the short code, finish, size, language, or markers to create a separate printing (art variant, rarity and signed alone are not enough), or edit the existing printing instead.`;
}

const PRINTING_IDENTITY_CONSTRAINTS = [
  "uq_printings_identity",
  "uq_faces_identity",
  "uq_faces_variant",
] as const;

export function asPrintingIdentityConflict(error: unknown, identity?: PrintingIdentity): unknown {
  if (!PRINTING_IDENTITY_CONSTRAINTS.some((name) => isUniqueViolationOn(error, name))) {
    return error;
  }
  return new AppError(
    409,
    ERROR_CODES.CONFLICT,
    identity
      ? existingPrintingMessage(identity)
      : "Another printing already has that code, finish, size, language and marker combination.",
  );
}

export function withPrintingIdentityConflicts(transact: Transact): Transact {
  return async <T>(fn: (repos: Repos) => Promise<T>): Promise<T> => {
    try {
      return await transact(fn);
    } catch (error) {
      throw asPrintingIdentityConflict(error);
    }
  };
}

export async function createNewPrinting(
  transact: Transact,
  cardId: string,
  printingFields: NewPrintingFields,
  candidatePrintingIds: readonly string[],
  options: { secondFaceId?: string | null } = {},
): Promise<NewPrinting> {
  try {
    return await transact((trx) =>
      insertNewPrinting(trx, cardId, printingFields, candidatePrintingIds, options),
    );
  } catch (error) {
    throw asPrintingIdentityConflict(error, newPrintingIdentity(cardId, printingFields));
  }
}

async function pinEditedCandidateLinks(
  trx: Pick<Repos, "candidateCards">,
  candidatePrintingIds: readonly string[],
  printingId: string,
  created: Parameters<typeof candidateAcceptKey>[0] & { cardId: string },
): Promise<void> {
  const createdKey = candidateAcceptKey(created);
  const candidates =
    await trx.candidateCards.linkIdentitiesForCandidatePrintings(candidatePrintingIds);
  const edited = candidates
    .filter(
      (candidate) =>
        candidate.liveCardId !== created.cardId || candidateAcceptKey(candidate) !== createdKey,
    )
    .map((candidate) => candidate.id);
  if (edited.length > 0) {
    await trx.candidateCards.upsertPrintingLinkOverrides(edited, printingId);
  }
}

export async function insertNewPrinting(
  trx: NewPrintingRepos,
  cardId: string,
  printingFields: NewPrintingFields,
  candidatePrintingIds: readonly string[],
  options: { secondFaceId?: string | null } = {},
): Promise<NewPrinting> {
  const secondFaceId = options.secondFaceId ?? null;
  const artist = trimToNull(printingFields.artist);
  const required: Record<RequiredAcceptPrintingField, string | null | undefined> = {
    shortCode: printingFields.shortCode,
    setId: printingFields.setId,
    rarity: printingFields.rarity,
    finish: resolveFinish(printingFields.finish, printingFields.rarity),
    artist,
    publicCode: printingFields.publicCode,
  };
  const missingFields = REQUIRED_ACCEPT_PRINTING_FIELDS.filter((field) => !required[field]);
  const { setId } = printingFields;
  if (missingFields.length > 0 || !setId || !artist) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      `A printing needs ${missingFields.join(", ")}; a missing finish is inferred from the rarity`,
    );
  }

  const mut = trx.catalogMutations;

  const markerSlugs = [...(printingFields.markerSlugs ?? [])].sort();
  const channelSlugs = printingFields.distributionChannelSlugs ?? [];

  const known = await loadKnownPrintingRefs(trx, channelSlugs);
  const unknown = unknownPrintingRefs({ ...printingFields, finish: required.finish }, known);
  if (unknown.length > 0) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, `Printing ${describeUnknownRefs(unknown)}`);
  }
  const normalizedRarity = knownRarity(known, printingFields.rarity) as Rarity;
  const channelRows = await trx.distributionChannels.listBySlugs(channelSlugs);

  const card = await mut.getCardById(cardId);
  assertFound(card, "Card not found");

  const identity = newPrintingIdentity(cardId, printingFields);
  const { finish, size, language } = identity;
  const { size: _size, ...faceIdentity } = identity;

  if (secondFaceId !== null) {
    assertFound(await mut.findFaceById(secondFaceId), "Second face not found");
    const firstFace = await mut.findFaceIdByIdentity(faceIdentity);
    if (firstFace?.id === secondFaceId) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, "The two faces must be different");
    }
  }

  const conflict = await newPrintingConflict(trx, identity, secondFaceId);
  if (conflict) {
    throw new AppError(409, ERROR_CODES.CONFLICT, conflict);
  }

  await trx.sets.upsert(setId, printingFields.setName ?? setId);
  const faceConflict = await facePrintedFieldConflict(trx, cardId, {
    ...printingFields,
    rarity: normalizedRarity,
  });
  if (faceConflict) {
    throw new AppError(409, ERROR_CODES.CONFLICT, faceConflict);
  }
  const printed = await printedFaceValues(trx, printingFields, normalizedRarity, artist);

  const printingId = await mut.insertPrinting(
    {
      ...printed,
      rarity: normalizedRarity,
      cardId,
      shortCode: printingFields.shortCode,
      markerSlugs,
      finish,
      size,
      artist,
      language,
    },
    secondFaceId,
  );
  await trx.distributionChannels.setForPrinting(
    printingId,
    channelRows.map((c) => ({ channelId: c.id })),
  );

  await trx.keywords.recomputeForPrintingCard(printingId);
  await trx.cardTokens.recomputeForPrintingCard(printingId);

  const imageIds: string[] = [];
  if (printingFields.imageUrl) {
    const face = await mut.findFaceIdByIdentity(faceIdentity);
    assertFound(face, "Created printing face not found");
    const imageId = await trx.printingImages.insertImage(
      printingId,
      printingFields.imageUrl,
      "main",
      await faceForNewImage(trx, printingId, { faceId: face.id }),
    );
    if (imageId) {
      imageIds.push(imageId);
    }
  }

  if (candidatePrintingIds.length > 0) {
    await trx.candidateCards.linkAndCheckCandidatePrintings([...candidatePrintingIds], printingId);
    await pinEditedCandidateLinks(trx, candidatePrintingIds, printingId, {
      cardId,
      shortCode: printingFields.shortCode,
      finish,
      rarity: normalizedRarity,
      markerSlugs,
      language,
      size,
    });
  }

  return { printingId, imageIds };
}
