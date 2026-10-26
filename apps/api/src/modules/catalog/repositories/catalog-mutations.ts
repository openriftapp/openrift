import type {
  ArtVariant,
  CardSize,
  CardType,
  Domain,
  Finish,
  Rarity,
  SuperType,
} from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { sql } from "kysely";
import type { Kysely, Selectable, Updateable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { CardsTable, FacesTable, PrintingsTable } from "../../../db/tables/catalog.js";
import { inTransaction, withFace1 } from "../../../repositories/query-helpers.js";

/**
 * A single-sided printing's identity: its face's `uq_faces_identity` columns
 * plus the printing's size. `findPrintingIdByIdentity` and `upsertPrinting`
 * share it so a caller checking "does this already exist?" cannot drift from
 * what the upsert actually treats as the same printing.
 */
export interface PrintingIdentity {
  cardId: string;
  shortCode: string;
  finish: Finish;
  size: CardSize;
  markerSlugs: string[];
  language: string;
}

/** A side never changes card: printings, deck slots and copies all assume it. */
type FaceFields = Omit<
  Updateable<FacesTable>,
  "id" | "cardId" | "createdAt" | "updatedAt" | "comment"
>;

export type PrintingUpdate = Updateable<PrintingsTable> & FaceFields;

const FACE_FIELDS = new Set<string>([
  "setId",
  "shortCode",
  "publicCode",
  "artVariant",
  "artist",
  "printedName",
  "printedRulesText",
  "printedEffectText",
  "flavorText",
  "language",
  "rarity",
  "printedYear",
  "finish",
  "isSigned",
  "isOvernumbered",
  "markerSlugs",
  "fallbackArtMode",
  "fallbackImageFileId",
] satisfies (keyof FaceFields)[]);

export type FullPrintingRow = Selectable<PrintingsTable> &
  Omit<Selectable<FacesTable>, "id" | "createdAt" | "updatedAt" | "comment">;

export function selectFullPrintings(db: Kysely<Database>, side: 1 | 2 = 1) {
  return db
    .selectFrom("printings as p")
    .innerJoin("faces as pf", "pf.id", side === 1 ? "p.face1Id" : "p.face2Id")
    .selectAll("p")
    .select([
      "pf.cardId",
      "pf.setId",
      "pf.shortCode",
      "pf.publicCode",
      "pf.artVariant",
      "pf.artist",
      "pf.printedName",
      "pf.printedRulesText",
      "pf.printedEffectText",
      "pf.flavorText",
      "pf.language",
      "pf.rarity",
      "pf.printedYear",
      "pf.finish",
      "pf.isSigned",
      "pf.isOvernumbered",
      "pf.markerSlugs",
      "pf.fallbackArtMode",
      "pf.fallbackImageFileId",
    ]);
}

export async function updatePrintingAndFace(
  db: Kysely<Database>,
  id: string,
  updates: PrintingUpdate,
  side: 1 | 2 = 1,
): Promise<void> {
  const printingUpdates: Record<string, unknown> = {};
  const faceUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    (FACE_FIELDS.has(key) ? faceUpdates : printingUpdates)[key] = value;
  }
  if (Object.keys(printingUpdates).length > 0) {
    await db.updateTable("printings").set(printingUpdates).where("id", "=", id).execute();
  }
  if (Object.keys(faceUpdates).length > 0) {
    const row = await db
      .selectFrom("printings")
      .select(["face1Id", "face2Id"])
      .where("id", "=", id)
      .executeTakeFirst();
    const faceId = side === 1 ? row?.face1Id : row?.face2Id;
    if (faceId) {
      await db.updateTable("faces").set(faceUpdates).where("id", "=", faceId).execute();
    }
  }
}

export function catalogMutationsRepo(db: Kysely<Database>) {
  function findFaceIdByIdentity(
    identity: Omit<PrintingIdentity, "size">,
  ): Promise<{ id: string } | undefined> {
    return db
      .selectFrom("faces")
      .select("id")
      .where("cardId", "=", identity.cardId)
      .where("shortCode", "=", identity.shortCode)
      .where("finish", "=", identity.finish)
      .where("markerSlugs", "=", sql<string[]>`${[...identity.markerSlugs].sort()}::text[]`)
      .where("language", "=", identity.language)
      .executeTakeFirst();
  }

  /** Matches the pair in either order: the display-order trigger may have swapped it. */
  function findPrintingIdByFaces(
    faceId: string,
    secondFaceId: string | null,
    size: string,
  ): Promise<{ id: string } | undefined> {
    return db
      .selectFrom("printings")
      .select("id")
      .where("size", "=", size)
      .where((eb) =>
        secondFaceId === null
          ? eb.and([eb("face1Id", "=", faceId), eb("face2Id", "is", null)])
          : eb.or([
              eb.and([eb("face1Id", "=", faceId), eb("face2Id", "=", secondFaceId)]),
              eb.and([eb("face1Id", "=", secondFaceId), eb("face2Id", "=", faceId)]),
            ]),
      )
      .executeTakeFirst();
  }

  async function findPrintingIdByIdentity(
    identity: PrintingIdentity,
    secondFaceId: string | null = null,
  ): Promise<{ id: string } | undefined> {
    const face = await findFaceIdByIdentity(identity);
    if (!face) {
      return undefined;
    }
    return findPrintingIdByFaces(face.id, secondFaceId, identity.size);
  }

  function updatePrintingById(id: string, updates: PrintingUpdate): Promise<void> {
    return updatePrintingAndFace(db, id, updates);
  }

  async function updateFaceById(id: string, updates: Updateable<FacesTable>): Promise<boolean> {
    const result = await db
      .updateTable("faces")
      .set(updates)
      .where("id", "=", id)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  function facesOnlyOn(printingIds: string[]) {
    return db
      .selectFrom("faces as f")
      .select("f.id")
      .where((eb) =>
        eb.and([
          eb.exists(
            eb
              .selectFrom("printings as mine")
              .select("mine.id")
              .where("mine.id", "in", printingIds)
              .where((inner) =>
                inner.or([
                  inner("mine.face1Id", "=", inner.ref("f.id")),
                  inner("mine.face2Id", "=", inner.ref("f.id")),
                ]),
              ),
          ),
          eb.not(
            eb.exists(
              eb
                .selectFrom("printings as other")
                .select("other.id")
                .where("other.id", "not in", printingIds)
                .where((inner) =>
                  inner.or([
                    inner("other.face1Id", "=", inner.ref("f.id")),
                    inner("other.face2Id", "=", inner.ref("f.id")),
                  ]),
                ),
            ),
          ),
        ]),
      );
  }

  return {
    findPrintingIdByIdentity,
    findFaceIdByIdentity,

    /** The side `faceId` is on now; a short-code edit may have re-sorted the pair. */
    async sideOfFace(printingId: string, faceId: string): Promise<1 | 2 | undefined> {
      const row = await db
        .selectFrom("printings")
        .select(["face1Id", "face2Id"])
        .where("id", "=", printingId)
        .executeTakeFirst();
      if (row?.face1Id === faceId) {
        return 1;
      }
      return row?.face2Id === faceId ? 2 : undefined;
    },

    findFaceById(id: string): Promise<{ id: string } | undefined> {
      return db.selectFrom("faces").select("id").where("id", "=", id).executeTakeFirst();
    },

    /** The side whose short code is `shortCode`; side 1 when neither matches. */
    getPrintingDifferentiatorsById(id: string, shortCode?: string) {
      return db
        .selectFrom("printingSidesOrdered as s")
        .select([
          "s.printingId as id",
          "s.finish",
          "s.artVariant",
          "s.isSigned",
          "s.isOvernumbered",
          "s.markerSlugs",
          "s.rarity",
        ])
        .where("s.printingId", "=", id)
        .orderBy(sql`upper(s.short_code) = upper(${shortCode ?? null}) DESC NULLS LAST`)
        .orderBy("s.position")
        .limit(1)
        .executeTakeFirst();
    },

    getPrintingById(
      id: string,
    ): Promise<{ id: string; shortCode: string; finish: string; language: string } | undefined> {
      return withFace1(db.selectFrom("printings as p"))
        .select(["p.id", "pf.shortCode", "pf.finish", "pf.language"])
        .where("p.id", "=", id)
        .executeTakeFirst();
    },

    getFullPrintingById(id: string, side: 1 | 2 = 1): Promise<FullPrintingRow | undefined> {
      return selectFullPrintings(db, side).where("p.id", "=", id).executeTakeFirst();
    },

    getFullCardById(id: string): Promise<Selectable<CardsTable> | undefined> {
      return db.selectFrom("cards").selectAll().where("id", "=", id).executeTakeFirst();
    },

    getPrintingCardIdByComposite(
      shortCode: string,
      finish: Finish,
      markerSlugs: string[],
      language: string,
    ): Promise<{ cardId: string } | undefined> {
      const sortedSlugs = [...markerSlugs].sort();
      return db
        .selectFrom("faces")
        .select("cardId")
        .where("shortCode", "=", shortCode)
        .where("finish", "=", finish)
        .where("markerSlugs", "=", sql<string[]>`${sortedSlugs}::text[]`)
        .where("language", "=", language)
        .executeTakeFirst();
    },

    getSetPrintedTotalForPrinting(
      printingId: string,
      side: 1 | 2 = 1,
    ): Promise<{ printedTotal: number | null } | undefined> {
      return db
        .selectFrom("printings as p")
        .innerJoin("faces as pf", "pf.id", side === 1 ? "p.face1Id" : "p.face2Id")
        .innerJoin("sets", "sets.id", "pf.setId")
        .select("sets.printedTotal")
        .where("p.id", "=", printingId)
        .executeTakeFirst();
    },

    getPrintingIdsByCardId(cardId: string): Promise<{ id: string }[]> {
      return db
        .selectFrom("printingSidesOrdered")
        .select("printingId as id")
        .distinct()
        .where("cardId", "=", cardId)
        .execute();
    },

    getPrintingTextsForCardId(
      cardId: string,
    ): Promise<Pick<Selectable<FacesTable>, "printedRulesText" | "printedEffectText">[]> {
      return db
        .selectFrom("faces")
        .select(["faces.printedRulesText", "faces.printedEffectText"])
        .where("faces.cardId", "=", cardId)
        .where("faces.language", "=", WellKnown.language.EN)
        .execute();
    },

    getPrintingTextsByCardIds(
      cardIds: string[],
    ): Promise<
      Pick<Selectable<FacesTable>, "cardId" | "printedRulesText" | "printedEffectText">[]
    > {
      if (cardIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("faces")
        .select(["cardId", "printedRulesText", "printedEffectText"])
        .where("cardId", "in", cardIds)
        .where("language", "=", WellKnown.language.EN)
        .execute();
    },

    getCardBySlug(slug: string): Promise<Pick<Selectable<CardsTable>, "id" | "name"> | undefined> {
      return db
        .selectFrom("cards")
        .select(["id", "name"])
        .where("slug", "=", slug)
        .executeTakeFirst();
    },

    getCardById(
      id: string,
    ): Promise<Pick<Selectable<CardsTable>, "id" | "name" | "slug"> | undefined> {
      return db
        .selectFrom("cards")
        .select(["id", "name", "slug"])
        .where("id", "=", id)
        .executeTakeFirst();
    },

    getCardIdBySlug(slug: string): Promise<Pick<Selectable<CardsTable>, "id"> | undefined> {
      return db.selectFrom("cards").select("id").where("slug", "=", slug).executeTakeFirst();
    },

    getCardsBySlugs(
      slugs: string[],
    ): Promise<Pick<Selectable<CardsTable>, "id" | "slug" | "name">[]> {
      if (slugs.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("cards")
        .select(["id", "slug", "name"])
        .where("slug", "in", slugs)
        .execute();
    },

    getCardAliases(cardId: string): Promise<{ normName: string }[]> {
      return db
        .selectFrom("cardNameAliases")
        .select("normName")
        .where("cardId", "=", cardId)
        .execute();
    },

    getSetIdBySlug(slug: string): Promise<{ id: string } | undefined> {
      return db.selectFrom("sets").select("id").where("slug", "=", slug).executeTakeFirst();
    },

    async updateCardById(id: string, updates: Updateable<CardsTable>): Promise<void> {
      await db.updateTable("cards").set(updates).where("id", "=", id).execute();
    },

    async renameCardSlugById(cardId: string, newSlug: string): Promise<void> {
      await db.updateTable("cards").set({ slug: newSlug }).where("id", "=", cardId).execute();
    },

    async replaceCardDomainsById(cardId: string, domains: string[]): Promise<void> {
      // Delete + insert must share a transaction: outside one, each statement
      // commits alone, so an insert refused by the FK (an unknown slug the
      // validator let through) would leave the delete committed and the card
      // stripped of all its domains.
      await inTransaction(db, async (trx) => {
        await trx.deleteFrom("cardDomains").where("cardId", "=", cardId).execute();
        if (domains.length > 0) {
          await trx
            .insertInto("cardDomains")
            .values(
              domains.map((domain, index) => ({
                cardId,
                domainSlug: domain,
                ordinal: index,
              })),
            )
            .execute();
        }
      });
    },

    /**
     * Replaces a card's types, keeping the denormalized `cards.type` scalar in
     * sync with the first type.
     */
    async replaceCardTypesById(cardId: string, types: string[]): Promise<void> {
      if (types.length === 0) {
        throw new Error("A card must have at least one type");
      }
      // Delete + insert must share a transaction: a deferred constraint
      // trigger rejects any COMMIT that leaves a card with zero junction rows,
      // and outside a transaction each statement commits on its own — the bare
      // delete would be rejected before the insert runs.
      await inTransaction(db, async (trx) => {
        await trx.deleteFrom("cardCardTypes").where("cardId", "=", cardId).execute();
        await trx
          .insertInto("cardCardTypes")
          .values(types.map((type, index) => ({ cardId, typeSlug: type, position: index })))
          .execute();
        await trx.updateTable("cards").set({ type: types[0] }).where("id", "=", cardId).execute();
      });
    },

    async replaceCardSuperTypesById(cardId: string, superTypes: string[]): Promise<void> {
      // Same transactional pairing as replaceCardDomainsById above.
      await inTransaction(db, async (trx) => {
        await trx.deleteFrom("cardSuperTypes").where("cardId", "=", cardId).execute();
        if (superTypes.length > 0) {
          await trx
            .insertInto("cardSuperTypes")
            .values(superTypes.map((superType) => ({ cardId, superTypeSlug: superType })))
            .execute();
        }
      });
    },

    async deleteCardBansByCardId(cardId: string): Promise<void> {
      await db.deleteFrom("cardBans").where("cardId", "=", cardId).execute();
    },

    async deleteMarketplaceCardOverridesByCardId(cardId: string): Promise<void> {
      await db.deleteFrom("marketplaceProductCardOverrides").where("cardId", "=", cardId).execute();
    },

    deleteCardById(id: string): Promise<{ id: string } | undefined> {
      return db.deleteFrom("cards").where("id", "=", id).returning("id").executeTakeFirst();
    },

    updatePrintingById,
    updateFaceById,

    /**
     * `field` is constrained to a real column so a caller's field allowlist is
     * checked against `printings` and `faces` at compile time; `value` stays
     * `unknown` because callers validate it per-field against the shared field rules.
     */
    async updatePrintingFieldById(
      id: string,
      field: keyof PrintingUpdate & string,
      value: unknown,
      side: 1 | 2 = 1,
    ): Promise<void> {
      await updatePrintingAndFace(db, id, { [field]: value }, side);
    },

    async deletePrintingById(id: string): Promise<{ id: string } | undefined> {
      const orphans = await facesOnlyOn([id]).execute();
      const orphanFaces = orphans.map((face) => face.id);
      const deleted = await db
        .deleteFrom("printings")
        .where("id", "=", id)
        .returning("id")
        .executeTakeFirst();
      if (deleted && orphanFaces.length > 0) {
        await db.deleteFrom("faces").where("id", "in", orphanFaces).execute();
      }
      return deleted;
    },

    // Select-then-write: the identity constraints are DEFERRABLE, which ON CONFLICT rejects as arbiters.
    async upsertPrinting(
      values: {
        cardId: string;
        setId: string;
        shortCode: string;
        rarity: Rarity;
        artVariant: ArtVariant;
        isSigned: boolean;
        isOvernumbered: boolean;
        markerSlugs: string[];
        finish: Finish;
        size: CardSize;
        artist: string;
        publicCode: string;
        printedRulesText: string | null;
        printedEffectText: string | null;
        flavorText: string | null;
        language: string;
        printedName: string | null;
        printedYear: number | null;
      },
      secondFaceId: string | null = null,
    ): Promise<string> {
      const { size, ...faceValues } = values;
      const existingFace = await findFaceIdByIdentity(values);
      if (!existingFace) {
        const inserted = await db
          .insertInto("faces")
          .values(faceValues)
          .returning("id")
          .executeTakeFirstOrThrow();
        // `/catalog` omits side 1's `faceId` when it equals the printing id.
        const result = await db
          .insertInto("printings")
          .values({ id: inserted.id, face1Id: inserted.id, face2Id: secondFaceId, size })
          .returning("id")
          .executeTakeFirstOrThrow();
        return result.id;
      }
      const faceId = existingFace.id;
      const existing = await findPrintingIdByFaces(faceId, secondFaceId, size);
      if (existing) {
        await db
          .updateTable("faces")
          .set({
            artist: values.artist,
            publicCode: values.publicCode,
            printedRulesText: values.printedRulesText,
            printedEffectText: values.printedEffectText,
            flavorText: values.flavorText,
            printedName: values.printedName,
            printedYear: values.printedYear,
          })
          .where("id", "=", faceId)
          .execute();
        return existing.id;
      }
      const result = await db
        .insertInto("printings")
        .values({ face1Id: faceId, face2Id: secondFaceId, size })
        .returning("id")
        .executeTakeFirstOrThrow();
      return result.id;
    },

    deletePrintingImagesByPrintingId(printingId: string): Promise<{ imageFileId: string }[]> {
      return db
        .deleteFrom("faceImages")
        .where("faceId", "in", facesOnlyOn([printingId]))
        .returning("imageFileId")
        .execute();
    },

    getImageFileById(
      imageFileId: string,
    ): Promise<{ id: string; rehostedUrl: string | null } | undefined> {
      return db
        .selectFrom("imageFiles")
        .select(["id", "rehostedUrl"])
        .where("id", "=", imageFileId)
        .executeTakeFirst();
    },

    async isImageFileReferenced(imageFileId: string): Promise<boolean> {
      // Must count both a face's own scan and its substitute-art pin by another face,
      // or the orphan sweep deletes a file still on screen.
      const result = await db
        .selectFrom("faceImages")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("imageFileId", "=", imageFileId)
        .executeTakeFirstOrThrow();
      if (Number(result.count) > 0) {
        return true;
      }
      const pin = await db
        .selectFrom("faces")
        .select("id")
        .where("fallbackImageFileId", "=", imageFileId)
        .limit(1)
        .executeTakeFirst();
      return pin !== undefined;
    },

    async deleteImageFileById(imageFileId: string): Promise<boolean> {
      const result = await db
        .deleteFrom("imageFiles")
        .where("id", "=", imageFileId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    /**
     * Creates a card from source data and links every candidate_cards row with
     * the given normalized name to it. Printings are accepted separately via
     * acceptNewPrintingFromSource.
     */
    async acceptNewCardFromSources(
      cardFields: {
        id: string;
        name: string;
        types: CardType[];
        superTypes?: SuperType[];
        domains: Domain[];
        might?: number | null;
        energy?: number | null;
        power?: number | null;
        mightBonus?: number | null;
        tags?: string[];
      },
      normalizedName: string,
    ): Promise<string> {
      const [primaryType] = cardFields.types;
      if (primaryType === undefined) {
        throw new Error("A card must have at least one type");
      }
      const { id: cardUuid } = await db
        .insertInto("cards")
        .values({
          slug: cardFields.id,
          name: cardFields.name,
          type: primaryType,
          might: cardFields.might ?? null,
          energy: cardFields.energy ?? null,
          power: cardFields.power ?? null,
          mightBonus: cardFields.mightBonus ?? null,
          keywords: [],
          tags: cardFields.tags ?? [],
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Position 0 mirrors cards.type.
      await db
        .insertInto("cardCardTypes")
        .values(
          cardFields.types.map((type, index) => ({
            cardId: cardUuid,
            typeSlug: type,
            position: index,
          })),
        )
        .execute();

      if (cardFields.domains.length > 0) {
        await db
          .insertInto("cardDomains")
          .values(
            cardFields.domains.map((domain, index) => ({
              cardId: cardUuid,
              domainSlug: domain,
              ordinal: index,
            })),
          )
          .execute();
      }

      const superTypes = cardFields.superTypes ?? [];
      if (superTypes.length > 0) {
        await db
          .insertInto("cardSuperTypes")
          .values(superTypes.map((superType) => ({ cardId: cardUuid, superTypeSlug: superType })))
          .execute();
      }

      await db
        .insertInto("cardNameAliases")
        .values({ normName: normalizedName, cardId: cardUuid })
        .onConflict((oc) => oc.column("normName").doUpdateSet({ cardId: cardUuid }))
        .execute();

      return cardUuid;
    },

    /**
     * Records the alias so `resolveCardIdByName` can match a candidate card
     * with this normalized name to the card.
     */
    async createNameAliases(normalizedName: string, cardId: string): Promise<void> {
      await db
        .insertInto("cardNameAliases")
        .values({ normName: normalizedName, cardId })
        .onConflict((oc) => oc.column("normName").doUpdateSet({ cardId }))
        .execute();
    },

    /**
     * Keep a card's self-alias in sync after a display-name change. The
     * `cards_set_norm_name` trigger rewrites `cards.norm_name` on every name
     * update, but nothing else maintains `card_name_aliases` — so without this
     * a rename strands the old-name self-alias and never creates the new one,
     * desyncing the card-detail view (matches by aliases) from the list view
     * (matches by `cards.norm_name`). Hand-added alt-spelling aliases are
     * untouched (only the old self-alias is removed). No-ops when the
     * normalized name is unchanged.
     */
    async syncSelfAliasOnRename(
      cardId: string,
      oldNormName: string,
      newNormName: string,
    ): Promise<void> {
      if (oldNormName === newNormName) {
        return;
      }
      await db
        .insertInto("cardNameAliases")
        .values({ normName: newNormName, cardId })
        .onConflict((oc) => oc.column("normName").doUpdateSet({ cardId }))
        .execute();
      await db
        .deleteFrom("cardNameAliases")
        .where("cardId", "=", cardId)
        .where("normName", "=", oldNormName)
        .execute();
    },
  };
}
