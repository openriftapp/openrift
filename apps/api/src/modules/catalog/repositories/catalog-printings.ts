import type { PrintingOtherSide, PrintingSide } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely, NotNull, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { FacesTable, PrintingsTable } from "../../../db/tables/catalog.js";
import type { PrintingSidesOrderedView } from "../../../db/tables/views.js";
import { fallbackImageId, imageId } from "../../../repositories/query-helpers.js";

type PrintingCodeRow = Pick<Selectable<FacesTable>, "cardId" | "shortCode" | "publicCode">;

export interface CatalogPrintingImageRow {
  printingId: string;
  side: PrintingSide;
  imageId: string;
  credit: string | null;
}

/** One scanner bank reference: a front render plus its label identity. */
export interface ScanReferenceRow {
  imageId: string;
  name: string;
  setSlug: string;
  publicCode: string;
  language: string;
  cardType: string;
  artVariant: string | null;
  isOvernumbered: boolean;
  createdAt: Date;
  /**
   * Min/max serialized marker set over every active front printing sharing
   * this image. Equal means the image's marker set is unanimous; a mismatch
   * means one render serves stamped and unstamped printings and carries no
   * stamp evidence for the scanner's disambiguation.
   */
  markersMin: string;
  markersMax: string;
}

/**
 * Printing row returned by the catalog. Marker metadata (label/description)
 * and distribution channels are resolved separately by the route layer using
 * the catalog's `markersList()` and the distribution-channels repo.
 *
 * One row per printing side, from the `printing_sides_ordered` view.
 * `canonicalRank` is the side's integer sort key.
 * Clients sort by this integer and get language-first, set-order, shortCode,
 * non-promo-first, finish-sort-order semantics in one compare. User language
 * preference overrides the language axis post-query.
 *
 * The date columns are omitted on purpose: only the admin printing desk
 * reads them, and this payload carries every printing of every card.
 */
type CatalogPrintingRow = Pick<
  PrintingSidesOrderedView,
  | "cardId"
  | "setId"
  | "shortCode"
  | "rarity"
  | "artVariant"
  | "isSigned"
  | "isOvernumbered"
  | "finish"
  | "size"
  | "artist"
  | "publicCode"
  | "printedRulesText"
  | "printedEffectText"
  | "flavorText"
  | "printedName"
  | "printedYear"
  | "language"
  | "markerSlugs"
  | "comment"
  | "fallbackArtMode"
  | "canonicalRank"
> & {
  printingId: string;
  side: PrintingSide;
  faceId: string;
  /** See {@link Printing.hasFoilTwin}; from `mv_printing_foil_twins`. */
  hasFoilTwin: boolean;
  /**
   * The pinned substitute's *servable* image id: the raw
   * `fallback_image_file_id` resolved through the same rehosted-or-nothing rule
   * as every other image id (see {@link fallbackImageId}). Null both when
   * nothing is pinned and when the pinned file has no rehosted copy yet.
   */
  fallbackImageId: string | null;
};

/** Reads that return a subset of sides carry the other side's card, since its row may be missing. */
type CatalogPrintingSubsetRow = CatalogPrintingRow & { otherSide: PrintingOtherSide | null };

/** Only the card detail read carries the slug; the bulk read is one row per printing of every card. */
type CatalogPrintingDetailRow = CatalogPrintingSubsetRow & { slug: string };

const SIDE_COLUMNS = [
  "s.printingId",
  sql<PrintingSide>`s.position`.as("side"),
  "s.faceId",
  "s.cardId",
  "s.setId",
  "s.shortCode",
  "s.rarity",
  "s.artVariant",
  "s.isSigned",
  "s.isOvernumbered",
  "s.finish",
  "s.size",
  "s.artist",
  "s.publicCode",
  "s.printedRulesText",
  "s.printedEffectText",
  "s.flavorText",
  "s.printedName",
  "s.printedYear",
  "s.language",
  "s.markerSlugs",
  "s.comment",
  "s.canonicalRank",
  "s.hasFoilTwin",
  "s.fallbackArtMode",
  fallbackImageId("s"),
] as const;

const OTHER_SIDE = sql<PrintingOtherSide | null>`(
  SELECT json_strip_nulls(json_build_object(
    'faceId', ofc.id,
    'cardId', oc.id,
    'cardName', oc.name,
    'cardSlug', oc.slug,
    'shortCode', ofc.short_code,
    'imageId', CASE WHEN oif.rehosted_url IS NOT NULL THEN oif.id END
  ))
  FROM printings op
  JOIN faces ofc ON ofc.id = CASE WHEN s.position = 1 THEN op.face2_id ELSE op.face1_id END
  JOIN cards oc ON oc.id = ofc.card_id
  LEFT JOIN face_images ofi ON ofi.face_id = ofc.id AND ofi.is_active
  LEFT JOIN image_files oif ON oif.id = ofi.image_file_id
  WHERE op.id = s.printing_id
)`.as("otherSide");

function selectSides(db: Kysely<Database>) {
  return db.selectFrom("printingSidesOrdered as s").select(SIDE_COLUMNS).orderBy("s.canonicalRank");
}

function selectSideSubset(db: Kysely<Database>) {
  return selectSides(db).select(OTHER_SIDE);
}

function selectPrintingImages(db: Kysely<Database>) {
  return db
    .selectFrom("printingSidesOrdered as s")
    .innerJoin("faceImages as fi", "fi.faceId", "s.faceId")
    .innerJoin("imageFiles as ci", "ci.id", "fi.imageFileId")
    .select([
      "s.printingId",
      sql<PrintingSide>`s.position`.as("side"),
      imageId("ci").as("imageId"),
      "ci.credit",
    ])
    .where("fi.isActive", "=", true)
    .where(sql`${imageId("ci")}`, "is not", null)
    .orderBy("s.printingId")
    .orderBy("s.position")
    .$narrowType<{ imageId: NotNull }>();
}

export function catalogPrintingsRepo(db: Kysely<Database>) {
  return {
    printings(): Promise<CatalogPrintingRow[]> {
      return selectSides(db).execute();
    },

    /**
     * Just the two lookup codes per printing, for building a code index. The
     * full `printings()` read carries every printed rules and flavor text on
     * every row, which is orders of magnitude more bytes than a code lookup
     * needs.
     */
    printingCodes(): Promise<PrintingCodeRow[]> {
      return db
        .selectFrom("faces")
        .select(["cardId", "shortCode", "publicCode"])
        .orderBy("shortCode")
        .execute();
    },

    printingImages(): Promise<CatalogPrintingImageRow[]> {
      return selectPrintingImages(db).execute();
    },

    async totalCopies(): Promise<number> {
      const result = await db
        .selectFrom("copies")
        .select(sql<string>`COUNT(*)`.as("count"))
        .executeTakeFirstOrThrow();
      return Number(result.count);
    },

    getPrintingById(id: string): Promise<Pick<Selectable<PrintingsTable>, "id"> | undefined> {
      return db.selectFrom("printings").select("id").where("id", "=", id).executeTakeFirst();
    },

    /**
     * `printings[0]` is the canonical default printing for SSR meta tags
     * and the UI's initially-selected printing.
     *
     * The ordering expression mirrors `mv_printing_sides_canonical_rank`, but
     * is computed fresh over this card's sides, so a printing added since the
     * last refresh still sorts into place. `canonicalRank` is therefore
     * per-card monotonic (1, 2, 3 …); consumers only use it as a within-card
     * tiebreaker.
     */
    printingsByCardId(cardId: string): Promise<CatalogPrintingDetailRow[]> {
      return db
        .selectFrom("printingSidesOrdered as s")
        .innerJoin("sets as st", "st.id", "s.setId")
        .innerJoin("finishes as f", "f.slug", "s.finish")
        .innerJoin("cardSizes as cs", "cs.slug", "s.size")
        .innerJoin("languages as l", "l.code", "s.language")
        .select([
          ...SIDE_COLUMNS.filter((column) => column !== "s.canonicalRank"),
          OTHER_SIDE,
          "s.slug",
          sql<number>`(row_number() OVER (
            ORDER BY
              l.sort_order,
              st.sort_order,
              s.short_code,
              array_length(s.marker_slugs, 1) IS NOT NULL,
              COALESCE(
                (SELECT MIN(m.sort_order) FROM markers m
                 WHERE m.slug = ANY(s.marker_slugs)),
                0
              ),
              f.sort_order,
              cs.sort_order,
              s.position
          ))::int`.as("canonicalRank"),
        ])
        .where("s.cardId", "=", cardId)
        .orderBy("canonicalRank")
        .execute();
    },

    printingImagesByCardId(cardId: string): Promise<CatalogPrintingImageRow[]> {
      return selectPrintingImages(db).where("s.cardId", "=", cardId).execute();
    },

    printingsBySetId(setId: string): Promise<CatalogPrintingSubsetRow[]> {
      return selectSideSubset(db).where("s.setId", "=", setId).execute();
    },

    printingsByCardIds(cardIds: string[]): Promise<CatalogPrintingSubsetRow[]> {
      if (cardIds.length === 0) {
        return Promise.resolve([]);
      }
      return selectSideSubset(db).where("s.cardId", "in", cardIds).execute();
    },

    printingImagesByCardIds(cardIds: string[]): Promise<CatalogPrintingImageRow[]> {
      if (cardIds.length === 0) {
        return Promise.resolve([]);
      }
      return selectPrintingImages(db).where("s.cardId", "in", cardIds).execute();
    },

    printingsByIds(ids: string[]): Promise<CatalogPrintingSubsetRow[]> {
      if (ids.length === 0) {
        return Promise.resolve([]);
      }
      return selectSideSubset(db).where("s.printingId", "in", ids).execute();
    },

    printingImagesBySetId(setId: string): Promise<CatalogPrintingImageRow[]> {
      return selectPrintingImages(db).where("s.setId", "=", setId).execute();
    },

    /**
     * Every active face render the scanner's embedding bank indexes, with the
     * identity fields the scan labels carry. One row per image file;
     * `createdAt` is the face image's creation time (the bank watermark is the
     * maximum over the built set).
     */
    scanReferences(): Promise<ScanReferenceRow[]> {
      return (
        db
          .selectFrom("faceImages as fi")
          .innerJoin("imageFiles as ci", "ci.id", "fi.imageFileId")
          .innerJoin("printingSidesOrdered as s", "s.faceId", "fi.faceId")
          .innerJoin("cards", "cards.id", "s.cardId")
          .innerJoin("sets", "sets.id", "s.setId")
          .select([
            imageId("ci").as("imageId"),
            "cards.name",
            "sets.slug as setSlug",
            "s.publicCode",
            "s.language",
            "cards.type as cardType",
            "s.artVariant",
            "s.isOvernumbered",
            "fi.createdAt",
            // Window aggregates run before distinctOn collapses the shared
            // images, so min/max span every side sharing the render;
            // equal min and max means the image's marker set is unanimous.
            sql<string>`min(array_to_string(s.marker_slugs, '+')) over (partition by ${imageId("ci")})`.as(
              "markersMin",
            ),
            sql<string>`max(array_to_string(s.marker_slugs, '+')) over (partition by ${imageId("ci")})`.as(
              "markersMax",
            ),
          ])
          .where("fi.isActive", "=", true)
          .where(sql`${imageId("ci")}`, "is not", null)
          // Faces can share one image file; the bank must carry each render
          // exactly once (duplicate keys would crowd the verification
          // shortlist). The printing id breaks ties deterministically.
          .distinctOn(imageId("ci"))
          .orderBy(imageId("ci"))
          .orderBy("s.printingId")
          .$narrowType<{ imageId: NotNull }>()
          .execute()
      );
    },

    async setCoverImageIds(): Promise<Map<string, string>> {
      const rows = await db
        .selectFrom("faces as f")
        .innerJoin("faceImages as fi", "fi.faceId", "f.id")
        .innerJoin("imageFiles as ci", "ci.id", "fi.imageFileId")
        .select(["f.setId", imageId("ci").as("imageId")])
        .where("fi.isActive", "=", true)
        .where(sql`${imageId("ci")}`, "is not", null)
        .distinctOn("f.setId")
        .orderBy("f.setId")
        .orderBy(sql`(f.language = ${WellKnown.language.EN}) DESC`)
        .orderBy("f.shortCode")
        .$narrowType<{ imageId: NotNull }>()
        .execute();
      return new Map(rows.map((r) => [r.setId, r.imageId]));
    },

    async setCountsAll(): Promise<Map<string, { cardCount: number; printingCount: number }>> {
      const rows = await db
        .selectFrom("printingSidesOrdered as s")
        .select([
          "s.setId",
          sql<string>`COUNT(DISTINCT s.card_id)`.as("cardCount"),
          sql<string>`COUNT(DISTINCT s.printing_id)`.as("printingCount"),
        ])
        .groupBy("s.setId")
        .execute();
      return new Map(
        rows.map((r) => [
          r.setId,
          { cardCount: Number(r.cardCount), printingCount: Number(r.printingCount) },
        ]),
      );
    },

    markersList(): Promise<
      { id: string; slug: string; label: string; description: string | null }[]
    > {
      return db
        .selectFrom("markers")
        .select(["id", "slug", "label", "description"])
        .orderBy("sortOrder")
        .orderBy("label")
        .execute();
    },

    printingImagesByPrintingIds(printingIds: string[]): Promise<CatalogPrintingImageRow[]> {
      if (printingIds.length === 0) {
        return Promise.resolve([]);
      }
      return selectPrintingImages(db).where("s.printingId", "in", printingIds).execute();
    },

    channelDistributedPrintings(): Promise<CatalogPrintingSubsetRow[]> {
      return selectSideSubset(db)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("printingDistributionChannels as pdc")
              .select(sql`1`.as("one"))
              .whereRef("pdc.printingId", "=", "s.printingId"),
          ),
        )
        .execute();
    },
  };
}
