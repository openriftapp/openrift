import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type {
  DeskSecondSide,
  DeskSharedPrinting,
} from "@openrift/shared/contracts/admin/printing-desk";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import type { CardFace } from "@openrift/shared/types/enums";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import { cardTypes, primaryCardType } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import { imageUrlWithOriginal, joinFaceImage } from "../../../repositories/query-helpers.js";
import type { FullPrintingRow, PrintingUpdate } from "./catalog-mutations.js";
import { selectFullPrintings, updatePrintingAndFace } from "./catalog-mutations.js";

export interface DeskPrintingRow {
  printingId: string;
  slug: string;
  cardId: string;
  cardSlug: string;
  cardName: string;
  cardType: string;
  setId: string;
  setName: string;
  setSlug: string;
  shortCode: string;
  publicCode: string;
  rarity: string;
  finish: string;
  language: string;
  size: string;
  artist: string;
  markerSlugs: string[];
  distributionChannelSlugs: string[];
  announcedAt: string | null;
  releasedAt: string | null;
  releasePrecision: ReleasePrecision | null;
  comment: string | null;
  imageCount: number;
  faceId: string;
  side: 1 | 2;
  secondSide: DeskSecondSide | null;
  sharedWith: DeskSharedPrinting[];
  activeImageFileId: string | null;
  activeImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  isPromo: boolean;
}

export interface DeskImageRow {
  printingImageId: string;
  imageFileId: string;
  url: string | null;
  isActive: boolean;
  rotation: number;
  face: CardFace;
  credit: string | null;
  quad: ImageQuad | null;
}

export interface DeskCardRow {
  id: string;
  slug: string;
  name: string;
  types: string[];
  domains: string[];
}

export interface DeskPostImageRow {
  printingId: string;
  cardId: string;
  cardName: string;
  cardType: string;
  publicCode: string;
  finish: string;
  artist: string;
  markerSlugs: string[];
  activeImageFileId: string | null;
}

export interface DeskImageCreditRow {
  credit: string | null;
}

export type DeskImageCreditPatch = Partial<DeskImageCreditRow>;

export type DeskPrintingFilter = { printingIds: readonly string[] } | { promosOnly: true };

export function printingDeskRepo(db: Kysely<Database>) {
  const channelSlugs = sql<string[]>`(
    SELECT coalesce(array_agg(dc.slug ORDER BY dc.slug), '{}')
    FROM printing_distribution_channels pdc
    JOIN distribution_channels dc ON dc.id = pdc.channel_id
    WHERE pdc.printing_id = p.id
  )`.as("distributionChannelSlugs");

  const imageCount = sql<number>`(
    SELECT count(*)::int FROM face_images pi2 WHERE pi2.face_id IN (p.face1_id, p.face2_id)
  )`.as("imageCount");

  const isPromo = sql<boolean>`(
    EXISTS (
      SELECT 1 FROM faces mf
      WHERE mf.id IN (p.face1_id, p.face2_id) AND cardinality(mf.marker_slugs) > 0
    )
    OR EXISTS (SELECT 1 FROM printing_distribution_channels pdc2 WHERE pdc2.printing_id = p.id)
  )`;

  const notPromo = sql<boolean>`NOT ${isPromo}`;

  const sharedWith = (faceColumn: "face1_id" | "face2_id") => sql<DeskSharedPrinting[]>`(
    SELECT coalesce(json_agg(json_build_object(
      'printingId', o.id, 'slug', o.slug, 'cardSlug', oc.slug, 'publicCode', osf.public_code,
      'side', CASE WHEN o.face2_id = ${sql.ref(`p.${faceColumn}`)} THEN 2 ELSE 1 END
    ) ORDER BY o.slug), '[]')
    FROM printings o
    JOIN faces osf ON osf.id = CASE
      WHEN o.face1_id = ${sql.ref(`p.${faceColumn}`)} THEN coalesce(o.face2_id, o.face1_id)
      ELSE o.face1_id
    END
    JOIN cards oc ON oc.id = osf.card_id
    WHERE o.id <> p.id AND ${sql.ref(`p.${faceColumn}`)} IN (o.face1_id, o.face2_id)
  )`;

  const secondSide = (otherColumn: "face1_id" | "face2_id") =>
    sql<DeskSecondSide | null>`(
    SELECT json_build_object(
      'faceId', f2.id, 'cardName', c2.name, 'cardSlug', c2.slug, 'setId', f2.set_id,
      'setName', s2.name, 'shortCode', f2.short_code, 'publicCode', f2.public_code,
      'rarity', f2.rarity, 'finish', f2.finish, 'language', f2.language, 'artist', f2.artist,
      'markerSlugs', f2.marker_slugs, 'sharedWith', ${sharedWith(otherColumn)}
    )
    FROM faces f2 JOIN cards c2 ON c2.id = f2.card_id JOIN sets s2 ON s2.id = f2.set_id
    WHERE f2.id = ${sql.ref(`p.${otherColumn}`)}
  )`.as("secondSide");

  /** `side` is the side the row presents; `secondSide` is then the other one. */
  function rowQuery(side: 1 | 2 = 1) {
    const ownColumn = side === 1 ? "face1_id" : "face2_id";
    const otherColumn = side === 1 ? "face2_id" : "face1_id";
    return joinFaceImage(
      db
        .selectFrom("printings as p")
        .innerJoin("faces as pf", "pf.id", side === 1 ? "p.face1Id" : "p.face2Id"),
      "pf.id",
    )
      .innerJoin("cards as c", "c.id", "pf.cardId")
      .innerJoin("sets as s", "s.id", "pf.setId")
      .select([
        "p.id as printingId",
        "p.slug",
        "pf.cardId",
        "c.slug as cardSlug",
        "c.name as cardName",
        primaryCardType("c.id").as("cardType"),
        "pf.setId",
        "s.name as setName",
        "s.slug as setSlug",
        "pf.shortCode",
        "pf.publicCode",
        "pf.rarity",
        "pf.finish",
        "pf.language",
        "p.size",
        "pf.artist",
        "pf.markerSlugs",
        "p.announcedAt",
        "p.releasedAt",
        "p.releasePrecision",
        "p.comment",
        "imgf.id as activeImageFileId",
        imageUrlWithOriginal("imgf").as("activeImageUrl"),
        "p.createdAt",
        "p.updatedAt",
        channelSlugs,
        imageCount,
        "pf.id as faceId",
        sql<1 | 2>`${sql.lit(side)}::int`.as("side"),
        secondSide(otherColumn),
        sharedWith(ownColumn).as("sharedWith"),
        isPromo.as("isPromo"),
      ])
      .orderBy("p.updatedAt", "desc");
  }

  /** A side left on no printing is deleted with its image links. */
  async function deleteFaceIfUnused(faceId: string): Promise<void> {
    const stillUsed = await db
      .selectFrom("printings")
      .select("id")
      .where((eb) => eb.or([eb("face1Id", "=", faceId), eb("face2Id", "=", faceId)]))
      .executeTakeFirst();
    if (!stillUsed) {
      await db.deleteFrom("faceImages").where("faceId", "=", faceId).execute();
      await db.deleteFrom("faces").where("id", "=", faceId).execute();
    }
  }

  return {
    async updatePrintingDeskFields(
      printingId: string,
      patch: PrintingUpdate,
      side: 1 | 2 = 1,
    ): Promise<void> {
      if (Object.keys(patch).length === 0) {
        return;
      }
      await updatePrintingAndFace(db, printingId, patch, side);
    },

    /** Empty `printingIds` short-circuits: Postgres rejects `WHERE id IN ()`. */
    listDeskPrintings(filter: DeskPrintingFilter): Promise<DeskPrintingRow[]> {
      if ("printingIds" in filter) {
        if (filter.printingIds.length === 0) {
          return Promise.resolve([]);
        }
        return rowQuery().where("p.id", "in", filter.printingIds).execute();
      }
      return rowQuery().where(isPromo).execute();
    },

    async listDeskPrintingsForCard(cardId: string): Promise<DeskPrintingRow[]> {
      const [first, second] = await Promise.all([
        rowQuery(1).where("pf.cardId", "=", cardId).execute(),
        rowQuery(2).where("pf.cardId", "=", cardId).execute(),
      ]);
      const onFirst = new Set(first.map((row) => row.printingId));
      return [...first, ...second.filter((row) => !onFirst.has(row.printingId))].toSorted(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    },

    async getFullPrintingForCard(
      printingId: string,
      cardId: string,
    ): Promise<FullPrintingRow | undefined> {
      const second = await selectFullPrintings(db, 2)
        .where("p.id", "=", printingId)
        .where("pf.cardId", "=", cardId)
        .executeTakeFirst();
      const first = await selectFullPrintings(db, 1)
        .where("p.id", "=", printingId)
        .executeTakeFirst();
      return first?.cardId === cardId || second === undefined ? first : second;
    },

    getFaceLinks(
      printingId: string,
    ): Promise<{ face1Id: string; face2Id: string | null } | undefined> {
      return db
        .selectFrom("printings")
        .select(["face1Id", "face2Id"])
        .where("id", "=", printingId)
        .executeTakeFirst();
    },

    findFace(faceId: string): Promise<{ id: string } | undefined> {
      return db.selectFrom("faces").select("id").where("id", "=", faceId).executeTakeFirst();
    },

    async setSecondFace(printingId: string, faceId: string): Promise<void> {
      await db
        .updateTable("printings")
        .set({ face2Id: faceId })
        .where("id", "=", printingId)
        .execute();
    },

    async deckCoversShowingFace(faceId: string): Promise<number> {
      const row = await db
        .selectFrom("decks")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("coverFaceId", "=", faceId)
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },

    async printingIdsShowingFace(faceId: string): Promise<string[]> {
      const rows = await db
        .selectFrom("printings")
        .select("id")
        .where((eb) => eb.or([eb("face1Id", "=", faceId), eb("face2Id", "=", faceId)]))
        .execute();
      return rows.map((row) => row.id);
    },

    lockFaceLinks(printingId: string): Promise<{ face1Id: string; face2Id: string | null }> {
      return db
        .selectFrom("printings")
        .select(["face1Id", "face2Id"])
        .where("id", "=", printingId)
        .forUpdate()
        .executeTakeFirstOrThrow();
    },

    /** Keeps the other side, whichever column the display order stored it in. */
    async dropFace(printingId: string, faceId: string): Promise<void> {
      const row = await db
        .selectFrom("printings")
        .select(["face1Id", "face2Id"])
        .where("id", "=", printingId)
        .executeTakeFirstOrThrow();
      const kept = row.face1Id === faceId ? row.face2Id : row.face1Id;
      if (kept === null) {
        return;
      }
      await db
        .updateTable("printings")
        .set({ face1Id: kept, face2Id: null })
        .where("id", "=", printingId)
        .execute();
      await deleteFaceIfUnused(faceId);
    },

    /** What users hold or point at on this printing, which a side change would silently redefine. */
    async userReferenceCounts(printingId: string): Promise<{
      copies: number;
      listEntries: number;
      trades: number;
      loans: number;
      listings: number;
      products: number;
      metaPicks: number;
      syncStates: number;
      linkOverrides: number;
      dismissals: number;
      deckSlots: number;
      history: number;
    }> {
      const count = (table: string, column = "printing_id") =>
        sql<number>`(SELECT count(*)::int FROM ${sql.table(table)} WHERE ${sql.ref(column)} = ${printingId})`;
      const row = await db
        .selectNoFrom([
          count("copies").as("copies"),
          count("list_entries").as("listEntries"),
          count("card_trades").as("trades"),
          count("loans").as("loans"),
          count("marketplace_product_variants").as("listings"),
          count("product_printings").as("products"),
          count("meta_event_player_overlay_cards", "preferred_printing_id").as("metaPicks"),
          count("cardmarket_sync_state").as("syncStates"),
          count("printing_link_overrides").as("linkOverrides"),
          count("trade_suggestion_dismissals").as("dismissals"),
          count("deck_cards", "preferred_printing_id").as("deckSlots"),
          count("collection_events").as("history"),
        ])
        .executeTakeFirstOrThrow();
      return row;
    },

    getDeskPrinting(printingId: string, side: 1 | 2 = 1): Promise<DeskPrintingRow | undefined> {
      return rowQuery(side).where("p.id", "=", printingId).executeTakeFirst();
    },

    async isDeskPrinting(printingId: string): Promise<boolean> {
      const row = await db
        .selectFrom("printings as p")
        .select("p.id")
        .where("p.id", "=", printingId)
        .where(isPromo)
        .executeTakeFirst();
      return row !== undefined;
    },

    async nonDeskPrintingIdsForImageFile(imageFileId: string): Promise<string[]> {
      const rows = await db
        .selectFrom("faceImages as pi")
        .innerJoin("printings as p", (join) =>
          join.on((eb) =>
            eb.or([
              eb("p.face1Id", "=", eb.ref("pi.faceId")),
              eb("p.face2Id", "=", eb.ref("pi.faceId")),
            ]),
          ),
        )
        .select("p.id")
        .where("pi.imageFileId", "=", imageFileId)
        .where(notPromo)
        .distinct()
        .execute();
      return rows.map((row) => row.id);
    },

    listDeskImages(printingId: string): Promise<DeskImageRow[]> {
      return db
        .selectFrom("printings as p")
        .innerJoin("faceImages as pi", (join) =>
          join.on((eb) =>
            eb.or([
              eb("pi.faceId", "=", eb.ref("p.face1Id")),
              eb("pi.faceId", "=", eb.ref("p.face2Id")),
            ]),
          ),
        )
        .innerJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId")
        .select([
          "pi.id as printingImageId",
          "imgf.id as imageFileId",
          imageUrlWithOriginal("imgf").as("url"),
          "pi.isActive",
          "imgf.rotation",
          sql<CardFace>`CASE WHEN pi.face_id = p.face1_id THEN 'front' ELSE 'back' END`.as("face"),
          "imgf.credit",
          "imgf.quad",
        ])
        .where("p.id", "=", printingId)
        .orderBy(sql`(pi.face_id = p.face1_id)`, "desc")
        .orderBy("pi.createdAt")
        .orderBy("pi.id")
        .execute();
    },

    async getDeskCardBySlug(slug: string): Promise<DeskCardRow | undefined> {
      const card = await db
        .selectFrom("cards")
        .select(["id", "slug", "name", cardTypes("cards.id").as("types")])
        .where("slug", "=", slug)
        .executeTakeFirst();
      if (!card) {
        return undefined;
      }
      const domains = await db
        .selectFrom("cardDomains")
        .select("domainSlug")
        .where("cardId", "=", card.id)
        .orderBy("ordinal")
        .execute();
      return { ...card, domains: domains.map((row) => row.domainSlug) };
    },

    /** The side holding `imageFileId` captions the post; side 1 when no side holds it. */
    getPostImageRow(
      printingId: string,
      imageFileId?: string,
    ): Promise<DeskPostImageRow | undefined> {
      return joinFaceImage(db.selectFrom("printingSidesOrdered as s"), "s.faceId")
        .innerJoin("cards as c", "c.id", "s.cardId")
        .select([
          "s.printingId",
          "s.cardId",
          "c.name as cardName",
          primaryCardType("c.id").as("cardType"),
          "s.publicCode",
          "s.finish",
          "s.artist",
          "s.markerSlugs",
          "imgf.id as activeImageFileId",
        ])
        .where("s.printingId", "=", printingId)
        .orderBy(
          sql`EXISTS (
            SELECT 1 FROM face_images held
            WHERE held.face_id = s.face_id AND held.image_file_id = ${imageFileId ?? null}::uuid
          ) DESC`,
        )
        .orderBy("s.position")
        .limit(1)
        .executeTakeFirst();
    },

    async getBasePrinting(cardId: string, language: string): Promise<FullPrintingRow | undefined> {
      for (const sameLanguage of [true, false]) {
        for (const side of [1, 2] as const) {
          let query = selectFullPrintings(db, side).where("pf.cardId", "=", cardId);
          if (sameLanguage) {
            query = query.where("pf.language", "=", language);
          }
          const row = await query.orderBy("p.createdAt").executeTakeFirst();
          if (row) {
            return row;
          }
        }
      }
      return undefined;
    },

    getFullPrinting(printingId: string, side: 1 | 2 = 1): Promise<FullPrintingRow | undefined> {
      return selectFullPrintings(db, side).where("p.id", "=", printingId).executeTakeFirst();
    },

    getImageCredit(imageFileId: string): Promise<DeskImageCreditRow | undefined> {
      return db
        .selectFrom("imageFiles")
        .select(["credit"])
        .where("id", "=", imageFileId)
        .executeTakeFirst();
    },

    async updateImageCredit(imageFileId: string, patch: DeskImageCreditPatch): Promise<void> {
      if (Object.keys(patch).length === 0) {
        return;
      }
      await db.updateTable("imageFiles").set(patch).where("id", "=", imageFileId).execute();
    },
  };
}
