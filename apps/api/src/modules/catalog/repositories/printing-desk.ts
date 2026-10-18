import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type {
  DeskSecondSide,
  DeskSharedPrinting,
} from "@openrift/shared/contracts/admin/printing-desk";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import type { CardFace } from "@openrift/shared/types/enums";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import {
  imageUrlWithOriginal,
  joinFaceImage,
  withFace1,
} from "../../../repositories/query-helpers.js";
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
  type: string;
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
      'printingId', o.id, 'slug', o.slug, 'cardSlug', oc.slug, 'publicCode', osf.public_code
    ) ORDER BY o.slug), '[]')
    FROM printings o
    JOIN faces osf ON osf.id = o.face1_id
    JOIN cards oc ON oc.id = osf.card_id
    WHERE o.id <> p.id AND ${sql.ref(`p.${faceColumn}`)} IN (o.face1_id, o.face2_id)
  )`;

  const secondSide = sql<DeskSecondSide | null>`(
    SELECT json_build_object(
      'faceId', f2.id, 'cardName', c2.name, 'cardSlug', c2.slug, 'setId', f2.set_id,
      'setName', s2.name, 'shortCode', f2.short_code, 'publicCode', f2.public_code,
      'rarity', f2.rarity, 'finish', f2.finish, 'language', f2.language, 'artist', f2.artist,
      'markerSlugs', f2.marker_slugs, 'sharedWith', ${sharedWith("face2_id")}
    )
    FROM faces f2 JOIN cards c2 ON c2.id = f2.card_id JOIN sets s2 ON s2.id = f2.set_id
    WHERE f2.id = p.face2_id
  )`.as("secondSide");

  function rowQuery() {
    return joinFaceImage(withFace1(db.selectFrom("printings as p")), "pf.id")
      .innerJoin("cards as c", "c.id", "pf.cardId")
      .innerJoin("sets as s", "s.id", "pf.setId")
      .select([
        "p.id as printingId",
        "p.slug",
        "pf.cardId",
        "c.slug as cardSlug",
        "c.name as cardName",
        "c.type as cardType",
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
        secondSide,
        sharedWith("face1_id").as("sharedWith"),
        isPromo.as("isPromo"),
      ])
      .orderBy("p.updatedAt", "desc");
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

    listDeskPrintingsForCard(cardId: string): Promise<DeskPrintingRow[]> {
      return rowQuery()
        .where(
          sql<boolean>`EXISTS (
            SELECT 1 FROM faces cf WHERE cf.id IN (p.face1_id, p.face2_id) AND cf.card_id = ${cardId}
          )`,
        )
        .execute();
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

    async setSecondFace(printingId: string, faceId: string | null): Promise<void> {
      await db
        .updateTable("printings")
        .set({ face2Id: faceId })
        .where("id", "=", printingId)
        .execute();
    },

    getDeskPrinting(printingId: string): Promise<DeskPrintingRow | undefined> {
      return rowQuery().where("p.id", "=", printingId).executeTakeFirst();
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
        .select(["id", "slug", "name", "type"])
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

    getPostImageRow(printingId: string): Promise<DeskPostImageRow | undefined> {
      return joinFaceImage(withFace1(db.selectFrom("printings as p")), "pf.id")
        .innerJoin("cards as c", "c.id", "pf.cardId")
        .select([
          "p.id as printingId",
          "pf.cardId",
          "c.name as cardName",
          "c.type as cardType",
          "pf.publicCode",
          "pf.finish",
          "pf.artist",
          "pf.markerSlugs",
          "imgf.id as activeImageFileId",
        ])
        .where("p.id", "=", printingId)
        .executeTakeFirst();
    },

    async getBasePrinting(cardId: string, language: string): Promise<FullPrintingRow | undefined> {
      const inLanguage = await selectFullPrintings(db)
        .where("pf.cardId", "=", cardId)
        .where("pf.language", "=", language)
        .orderBy("p.createdAt")
        .executeTakeFirst();
      if (inLanguage) {
        return inLanguage;
      }
      return await selectFullPrintings(db)
        .where("pf.cardId", "=", cardId)
        .orderBy("p.createdAt")
        .executeTakeFirst();
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
