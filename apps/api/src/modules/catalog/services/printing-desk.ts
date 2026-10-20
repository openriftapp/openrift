import type {
  DeskCreateInput,
  DeskUpdateInput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { appendSetTotal } from "@openrift/shared/fix-typography";
import { isTbaCode, tbaPublicCode, tbaShortCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { normalizeToPeriodStart } from "@openrift/shared/set-release";
import { WellKnown } from "@openrift/shared/well-known";

import type { PrintingsTable } from "../../../db/tables/catalog.js";
import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { assertFound } from "../../../lib/assertions.js";
import { isUniqueViolationOn } from "../../../lib/pg-errors.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import type { PrintingUpdate } from "../repositories/catalog-mutations.js";
import {
  acceptPrinting,
  updatePrintingDistributionChannels,
  updatePrintingMarkers,
} from "./printing-admin.js";

interface DeskRelease {
  releasedAt: string | null;
  releasePrecision: PrintingsTable["releasePrecision"];
}

/** Not a check-then-act: two edits racing to the same identity would both pass a pre-read. */
function asIdentityConflict(error: unknown): unknown {
  if (
    isUniqueViolationOn(error, "uq_printings_identity") ||
    isUniqueViolationOn(error, "uq_faces_identity") ||
    isUniqueViolationOn(error, "uq_faces_variant")
  ) {
    return new AppError(
      409,
      ERROR_CODES.CONFLICT,
      "Another printing already has that code, finish, size, language and marker combination.",
    );
  }
  return error;
}

/**
 * `chk_printings_release_period_start` rejects a mid-period date at a coarse
 * precision, so the date is snapped before it reaches the write.
 */
function normalizeRelease(release: DeskRelease): DeskRelease {
  const { releasedAt, releasePrecision } = release;
  if ((releasedAt === null) !== (releasePrecision === null)) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      "Set both a release date and a precision, or neither.",
    );
  }
  const normalized = normalizeToPeriodStart({ releasedAt, precision: releasePrecision });
  return { releasedAt: normalized.releasedAt, releasePrecision: normalized.precision };
}

/**
 * The desk's universe is promo printings (a marker or a distribution channel)
 * plus whatever the caller added, so a base-set printing stays admin-only.
 */
export async function assertDeskPrintingScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  printingId: string,
): Promise<void> {
  if (adminAccess?.isAdmin) {
    return;
  }
  if (await repos.printingDesk.isDeskPrinting(printingId)) {
    return;
  }
  if (await repos.adminEvents.wasPrintingCreatedBy(printingId, userId)) {
    return;
  }
  throw new AppError(
    403,
    ERROR_CODES.FORBIDDEN,
    "Only the admin can change a printing outside the desk",
  );
}

/** A side shown on several printings is shared by all of them, so each must be in scope. */
async function assertFaceScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  faceId: string,
): Promise<void> {
  if (adminAccess?.isAdmin) {
    return;
  }
  for (const printingId of await repos.printingDesk.printingIdsShowingFace(faceId)) {
    await assertDeskPrintingScope(repos, adminAccess, userId, printingId);
  }
}

export async function assertImageScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk" | "printingImages">,
  adminAccess: AdminAccess | null,
  userId: string,
  imageId: string,
): Promise<void> {
  if (adminAccess?.isAdmin) {
    return;
  }
  const faceId = await repos.printingImages.faceIdOfImage(imageId);
  assertFound(faceId, "Printing image not found");
  await assertFaceScope(repos, adminAccess, userId, faceId);
}

export async function assertPrintingSideScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  printingId: string,
  face: "front" | "back",
): Promise<void> {
  const links = await repos.printingDesk.getFaceLinks(printingId);
  assertFound(links, "Printing not found");
  const faceId = face === "back" ? links.face2Id : links.face1Id;
  if (faceId === null) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "That printing has no second face");
  }
  await assertFaceScope(repos, adminAccess, userId, faceId);
}

/** An image file can hang on several printings; every one of them must be in scope. */
export async function assertDeskImageFileScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  imageFileId: string,
): Promise<void> {
  if (adminAccess?.isAdmin) {
    return;
  }
  const outside = await repos.printingDesk.nonDeskPrintingIdsForImageFile(imageFileId);
  const added = await Promise.all(
    outside.map((printingId) => repos.adminEvents.wasPrintingCreatedBy(printingId, userId)),
  );
  if (added.every(Boolean)) {
    return;
  }
  throw new AppError(
    403,
    ERROR_CODES.FORBIDDEN,
    "Only the admin can change an image on a printing outside the desk",
  );
}

export async function imagesDeletableBy(
  repos: Pick<Repos, "adminEvents">,
  adminAccess: AdminAccess | null,
  userId: string,
  imageIds: readonly string[],
): Promise<Set<string>> {
  if (adminAccess?.isAdmin) {
    return new Set(imageIds);
  }
  return new Set(await repos.adminEvents.imageIdsUploadedBy(imageIds, userId));
}

export async function assertImageUploader(
  repos: Pick<Repos, "adminEvents">,
  adminAccess: AdminAccess | null,
  userId: string,
  imageId: string,
): Promise<void> {
  const deletable = await imagesDeletableBy(repos, adminAccess, userId, [imageId]);
  if (deletable.has(imageId)) {
    return;
  }
  throw new AppError(
    403,
    ERROR_CODES.FORBIDDEN,
    "Only the admin can delete an image you did not upload",
  );
}

type CreateRepos = Pick<
  Repos,
  | "adminEvents"
  | "catalog"
  | "catalogMutations"
  | "distributionChannels"
  | "markers"
  | "printingDesk"
  | "printingEvents"
  | "printingImages"
  | "sets"
>;

export async function createDeskPrinting(
  transact: Transact,
  repos: CreateRepos,
  io: Io,
  userId: string,
  input: DeskCreateInput,
): Promise<string> {
  const { cardId, basePrintingId, codeTba, secondSideFaceId, ...fields } = input;

  const card = await repos.catalogMutations.getCardById(cardId);
  assertFound(card, "Card not found");

  // The desk speaks set uuids; `acceptPrinting` takes the slug.
  const set = await repos.sets.getRef(fields.setId);
  assertFound(set, "Set not found");

  const base = basePrintingId
    ? await repos.printingDesk.getFullPrintingForCard(basePrintingId, cardId)
    : await repos.printingDesk.getBasePrinting(cardId, fields.language);

  const artist = fields.artist ?? base?.artist;
  if (!artist) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      "This card has no printing to copy from; artist is required.",
    );
  }

  const shortCode = codeTba ? tbaShortCode(set.slug, card.slug) : fields.shortCode;
  if (!shortCode) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "A short code is required.");
  }

  const release = normalizeRelease({
    releasedAt: fields.releasedAt,
    releasePrecision: fields.releasePrecision,
  });

  let printingId: string;
  try {
    printingId = await acceptPrinting(
      transact,
      repos,
      cardId,
      {
        shortCode,
        publicCode: codeTba ? tbaPublicCode(set.slug) : shortCode,
        setId: set.slug,
        setName: set.name,
        finish: fields.finish,
        size: fields.size,
        language: fields.language,
        artist,
        markerSlugs: fields.markerSlugs,
        distributionChannelSlugs: fields.distributionChannelSlugs,
        rarity: base?.rarity ?? WellKnown.rarity.COMMON,
        artVariant: WellKnown.artVariant.NORMAL,
        isSigned: false,
        printedRulesText: base?.printedRulesText ?? null,
        printedEffectText: base?.printedEffectText ?? null,
        flavorText: base?.flavorText ?? null,
        printedName: base?.printedName ?? null,
      },
      [],
      io,
      { requireNew: true, secondFaceId: secondSideFaceId ?? null },
    );
  } catch (error) {
    throw asIdentityConflict(error);
  }

  await repos.printingDesk.updatePrintingDeskFields(printingId, {
    announcedAt: fields.announcedAt,
    releasedAt: release.releasedAt,
    releasePrecision: release.releasePrecision,
    comment: fields.comment,
  });
  // `acceptPrinting` runs the public code through `appendSetTotal`, which would
  // turn a TBA code into "<SET>-TBA/<total>"; the desk's TBA code stays unnumbered.
  if (codeTba) {
    const face = await repos.catalogMutations.findFaceIdByIdentity({
      cardId,
      shortCode,
      finish: fields.finish,
      markerSlugs: fields.markerSlugs,
      language: fields.language,
    });
    if (face) {
      await repos.catalogMutations.updateFaceById(face.id, {
        publicCode: tbaPublicCode(set.slug),
      });
    }
  }

  await recordAdminEvent(repos, userId, {
    action: "printing.create",
    entityType: "printing",
    entityId: printingId,
    entityLabel: shortCode,
    cardSlug: card.slug,
    newValues: { ...fields, cardId, codeTba, shortCode, artist },
  });

  await repos.catalog.refreshCatalogViews();

  return printingId;
}

const SCALAR_FIELDS = [
  "setId",
  "finish",
  "size",
  "language",
  "artist",
  "announcedAt",
  "comment",
] as const;

type UpdateRepos = Pick<
  Repos,
  | "adminEvents"
  | "catalog"
  | "catalogMutations"
  | "distributionChannels"
  | "markers"
  | "printingDesk"
  | "sets"
>;

/** A side change redefines the printing; data users hold on it moves through the pair merge. */
async function assertNoUserReferences(
  repos: Pick<Repos, "printingDesk">,
  printingId: string,
): Promise<void> {
  const counts = await repos.printingDesk.userReferenceCounts(printingId);
  const held = Object.entries(counts).filter(([, count]) => count > 0);
  if (held.length > 0) {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      `This printing has ${held.map(([noun, count]) => `${count} ${REFERENCE_NOUNS[noun as keyof typeof counts]}`).join(", ")}. Changing its faces would change what they are.`,
    );
  }
}

const REFERENCE_NOUNS = {
  copies: "copies",
  listEntries: "list entries",
  trades: "trades",
  loans: "loans",
  listings: "marketplace listings",
  products: "product contents",
  metaPicks: "meta deck picks",
  syncStates: "Cardmarket sync rows",
  linkOverrides: "link overrides",
  dismissals: "dismissed trade suggestions",
  deckSlots: "deck slots",
  history: "collection history events",
} as const;

export async function setDeskSecondSide(
  transact: Transact,
  repos: Pick<Repos, "adminEvents" | "catalog" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  input: { printingId: string; faceId: string },
): Promise<void> {
  const { printingId, faceId } = input;
  assertFound(await repos.printingDesk.getFaceLinks(printingId), "Printing not found");
  await assertDeskPrintingScope(repos, adminAccess, userId, printingId);
  assertFound(await repos.printingDesk.findFace(faceId), "Face not found");

  try {
    await transact(async (trxRepos) => {
      // The row lock holds off new copies and trades until the change commits.
      const locked = await trxRepos.printingDesk.lockFaceLinks(printingId);
      if (faceId === locked.face1Id) {
        throw new AppError(400, ERROR_CODES.BAD_REQUEST, "The two faces must be different");
      }
      if (locked.face2Id !== null) {
        throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Remove the current second face first");
      }
      await assertNoUserReferences(trxRepos, printingId);
      await trxRepos.printingDesk.setSecondFace(printingId, faceId);
    });
  } catch (error) {
    throw asIdentityConflict(error);
  }

  await recordAdminEvent(repos, userId, {
    action: "printing.update",
    entityType: "printing",
    entityId: printingId,
    entityLabel: printingId,
    cardSlug: null,
    oldValues: { face2Id: null },
    newValues: { face2Id: faceId },
  });

  await repos.catalog.refreshCatalogViews();
}

export async function removeDeskSide(
  transact: Transact,
  repos: Pick<Repos, "adminEvents" | "catalog" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  input: { printingId: string; faceId: string },
): Promise<void> {
  const { printingId, faceId } = input;
  assertFound(await repos.printingDesk.getFaceLinks(printingId), "Printing not found");
  await assertDeskPrintingScope(repos, adminAccess, userId, printingId);

  let before: { face1Id: string; face2Id: string | null } | undefined;
  try {
    await transact(async (trxRepos) => {
      const locked = await trxRepos.printingDesk.lockFaceLinks(printingId);
      if (locked.face2Id === null || (faceId !== locked.face1Id && faceId !== locked.face2Id)) {
        throw new AppError(400, ERROR_CODES.BAD_REQUEST, "That face is not on the printing");
      }
      await assertNoUserReferences(trxRepos, printingId);
      // A side left on no printing is deleted, which would clear the decks using it as a cover.
      const showing = await trxRepos.printingDesk.printingIdsShowingFace(faceId);
      const onlyHere = showing.length <= 1;
      const covers = onlyHere ? await trxRepos.printingDesk.deckCoversShowingFace(faceId) : 0;
      if (covers > 0) {
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          `${covers} ${covers === 1 ? "deck uses" : "decks use"} this face as a cover.`,
        );
      }
      await trxRepos.printingDesk.dropFace(printingId, faceId);
      before = locked;
    });
  } catch (error) {
    throw asIdentityConflict(error);
  }

  await recordAdminEvent(repos, userId, {
    action: "printing.update",
    entityType: "printing",
    entityId: printingId,
    entityLabel: printingId,
    cardSlug: null,
    oldValues: { face1Id: before?.face1Id ?? null, face2Id: before?.face2Id ?? null },
    newValues: { removedFaceId: faceId },
  });

  await repos.catalog.refreshCatalogViews();
}

async function assertSharedSideScope(
  repos: Pick<Repos, "adminEvents" | "printingDesk">,
  adminAccess: AdminAccess | null,
  userId: string,
  printingId: string,
  side: 1 | 2,
): Promise<void> {
  const links = await repos.printingDesk.getFaceLinks(printingId);
  const faceId = side === 1 ? links?.face1Id : links?.face2Id;
  if (faceId) {
    await assertFaceScope(repos, adminAccess, userId, faceId);
  }
}

export async function updateDeskPrinting(
  transact: Transact,
  repos: UpdateRepos,
  adminAccess: AdminAccess | null,
  userId: string,
  input: DeskUpdateInput,
): Promise<void> {
  const {
    printingId,
    side = 1,
    codeTba,
    shortCode,
    markerSlugs,
    distributionChannelSlugs,
    ...fields
  } = input;

  const before = await repos.printingDesk.getFullPrinting(printingId, side);
  assertFound(before, side === 1 ? "Printing not found" : "The printing has no second face");
  await assertDeskPrintingScope(repos, adminAccess, userId, printingId);
  const editsSide =
    markerSlugs !== undefined ||
    codeTba !== undefined ||
    shortCode !== undefined ||
    Object.keys(fields).some((key) => !isPrintingLevelField(key));
  if (editsSide && !adminAccess?.isAdmin) {
    await assertSharedSideScope(repos, adminAccess, userId, printingId, side);
  }

  const channelsBefore =
    distributionChannelSlugs === undefined
      ? []
      : await repos.distributionChannels.listForPrintingIds([printingId]);
  const beforeChannelSlugs = channelsBefore.map((row) => row.channelSlug);

  const patch: PrintingUpdate = {};
  for (const field of SCALAR_FIELDS) {
    if (fields[field] !== undefined) {
      patch[field] = fields[field] as never;
    }
  }
  const nextSet =
    patch.setId === undefined ? undefined : await repos.sets.getRef(String(patch.setId));
  if (patch.setId !== undefined) {
    assertFound(nextSet, "Set not found");
  }
  if (fields.releasedAt !== undefined || fields.releasePrecision !== undefined) {
    const release = normalizeRelease({
      releasedAt: fields.releasedAt === undefined ? before.releasedAt : fields.releasedAt,
      releasePrecision:
        fields.releasePrecision === undefined ? before.releasePrecision : fields.releasePrecision,
    });
    patch.releasedAt = release.releasedAt;
    patch.releasePrecision = release.releasePrecision;
  }

  // A TBA code names its set, so moving the printing has to rewrite it.
  const tbaAfter = codeTba ?? (shortCode === undefined && isTbaCode(before.publicCode));
  if (codeTba !== undefined || shortCode !== undefined || (nextSet !== undefined && tbaAfter)) {
    const card = await repos.catalogMutations.getCardById(before.cardId);
    assertFound(card, "Card not found");
    if (tbaAfter) {
      const set = nextSet ?? (await repos.sets.getRef(before.setId));
      assertFound(set, "Set not found");
      patch.shortCode = tbaShortCode(set.slug, card.slug);
      patch.publicCode = tbaPublicCode(set.slug);
    } else {
      const nextShortCode = shortCode ?? before.shortCode;
      const total = await repos.sets.getPrintedTotal(String(patch.setId ?? before.setId));
      patch.shortCode = nextShortCode;
      patch.publicCode = appendSetTotal(nextShortCode, total?.printedTotal ?? null);
    }
  }

  try {
    await transact(async (trxRepos) => {
      // Markers first: a short-code change can re-sort the sides, after which `side` names the other one.
      if (markerSlugs !== undefined) {
        await updatePrintingMarkers((fn) => fn(trxRepos), printingId, markerSlugs, side);
      }
      await trxRepos.printingDesk.updatePrintingDeskFields(printingId, patch, side);
      if (distributionChannelSlugs !== undefined) {
        await updatePrintingDistributionChannels(trxRepos, printingId, distributionChannelSlugs);
      }
    });
  } catch (error) {
    throw asIdentityConflict(error);
  }

  const changed = Object.keys(patch);
  const faceCard = editsSide ? await repos.catalogMutations.getCardById(before.cardId) : undefined;
  await recordAdminEvent(repos, userId, {
    action: "printing.update",
    entityType: "printing",
    entityId: printingId,
    entityLabel: patch.shortCode === undefined ? before.shortCode : String(patch.shortCode),
    cardSlug: faceCard?.slug ?? null,
    oldValues: {
      ...Object.fromEntries(changed.map((key) => [key, before[key as keyof typeof before]])),
      ...(markerSlugs === undefined ? {} : { markerSlugs: before.markerSlugs }),
      ...(distributionChannelSlugs === undefined
        ? {}
        : { distributionChannelSlugs: beforeChannelSlugs }),
    },
    newValues: {
      ...patch,
      ...(markerSlugs === undefined ? {} : { markerSlugs }),
      ...(distributionChannelSlugs === undefined ? {} : { distributionChannelSlugs }),
    },
  });

  await repos.catalog.refreshCatalogViews();
}
