import { getOrientation } from "@openrift/shared/card-orientation";
import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type { CardFace, FallbackArtMode } from "@openrift/shared/types/enums";
import type { Kysely, RawBuilder } from "kysely";
import { sql } from "kysely";

import { cardTypes } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";

function printingFaceId(printingId: string, face: CardFace): RawBuilder<string | null> {
  return sql<string | null>`(
    SELECT CASE WHEN ${face} = 'back' THEN p.face2_id ELSE p.face1_id END
    FROM printings p WHERE p.id = ${printingId}
  )`;
}

const IMAGE_PRINTING_ID = sql<string>`(
  SELECT p.id FROM printings p
  WHERE p.face1_id = fi.face_id OR p.face2_id = fi.face_id
  ORDER BY (p.face1_id = fi.face_id) DESC, p.id
  LIMIT 1
)`;

const IMAGE_FACE = sql<CardFace>`(
  SELECT CASE WHEN p.face1_id = fi.face_id THEN 'front' ELSE 'back' END
  FROM printings p
  WHERE p.face1_id = fi.face_id OR p.face2_id = fi.face_id
  ORDER BY (p.face1_id = fi.face_id) DESC, p.id
  LIMIT 1
)`;

export function printingImagesRepo(db: Kysely<Database>) {
  async function requireFaceId(printingId: string, face: CardFace): Promise<string> {
    const row = await db
      .selectNoFrom(printingFaceId(printingId, face).as("faceId"))
      .executeTakeFirstOrThrow();
    if (!row.faceId) {
      throw new Error(`printing ${printingId} has no ${face} side`);
    }
    return row.faceId;
  }

  /** `ON CONFLICT`'s `where` must match `idx_image_files_original_url`'s partial predicate. */
  async function findOrCreateImageFile(originalUrl: string): Promise<string> {
    const inserted = await db
      .insertInto("imageFiles")
      .values({ originalUrl })
      .onConflict((oc) => oc.column("originalUrl").where("originalUrl", "is not", null).doNothing())
      .returning("id")
      .executeTakeFirst();
    if (inserted) {
      return inserted.id;
    }
    const existing = await db
      .selectFrom("imageFiles")
      .select("id")
      .where("originalUrl", "=", originalUrl)
      .executeTakeFirstOrThrow();
    return existing.id;
  }

  return {
    async landscapeImageIds(imageIds: readonly string[]): Promise<Set<string>> {
      if (imageIds.length === 0) {
        return new Set();
      }
      const rows = await db
        .selectFrom("faceImages as pi")
        .innerJoin("faces as f", "f.id", "pi.faceId")
        .select(["pi.imageFileId", cardTypes("f.cardId").as("types")])
        .where("pi.imageFileId", "in", [...imageIds])
        .distinct()
        .execute();
      return new Set(
        rows
          .filter((row) => getOrientation(row.types) === "landscape")
          .map((row) => row.imageFileId),
      );
    },

    getIdAndRehostedUrl(
      imageId: string,
    ): Promise<{ id: string; printingId: string; rehostedUrl: string | null } | undefined> {
      return db
        .selectFrom("faceImages as fi")
        .innerJoin("imageFiles as imgf", "imgf.id", "fi.imageFileId")
        .select(["fi.id", IMAGE_PRINTING_ID.as("printingId"), "imgf.rehostedUrl"])
        .where("fi.id", "=", imageId)
        .executeTakeFirst();
    },

    getIdAndUrls(
      imageId: string,
    ): Promise<{ id: string; rehostedUrl: string | null; originalUrl: string | null } | undefined> {
      return db
        .selectFrom("faceImages")
        .innerJoin("imageFiles as imgf", "imgf.id", "faceImages.imageFileId")
        .select(["faceImages.id", "imgf.rehostedUrl", "imgf.originalUrl"])
        .where("faceImages.id", "=", imageId)
        .executeTakeFirst();
    },

    getForActivate(imageId: string) {
      return db
        .selectFrom("faceImages as fi")
        .select(["fi.id", IMAGE_PRINTING_ID.as("printingId"), IMAGE_FACE.as("face")])
        .where("fi.id", "=", imageId)
        .executeTakeFirst();
    },

    getForRehost(imageId: string) {
      return db
        .selectFrom("faceImages as fi")
        .innerJoin("imageFiles as imgf", "imgf.id", "fi.imageFileId")
        .select([
          "fi.id",
          IMAGE_PRINTING_ID.as("printingId"),
          "fi.imageFileId",
          "imgf.originalUrl",
          "imgf.rotation",
          "imgf.needsTrim",
          "imgf.quad",
        ])
        .where("fi.id", "=", imageId)
        .executeTakeFirst();
    },

    async getVariantSettingsByIds(
      ids: string[],
    ): Promise<Map<string, { rotation: number; needsTrim: boolean; quad: ImageQuad | null }>> {
      if (ids.length === 0) {
        return new Map();
      }
      const rows = await db
        .selectFrom("imageFiles")
        .select(["id", "rotation", "needsTrim", "quad"])
        .where("id", "in", ids)
        .execute();
      return new Map(
        rows.map((r) => [r.id, { rotation: r.rotation, needsTrim: r.needsTrim, quad: r.quad }]),
      );
    },

    async setRotation(imageFileId: string, rotation: 0 | 90 | 180 | 270): Promise<void> {
      await db
        .updateTable("imageFiles")
        .set({ rotation, fingerprint: null })
        .where("id", "=", imageFileId)
        .execute();
    },

    async setNeedsTrim(imageFileId: string, needsTrim: boolean): Promise<void> {
      await db
        .updateTable("imageFiles")
        .set({ needsTrim, fingerprint: null })
        .where("id", "=", imageFileId)
        .execute();
    },

    async setQuad(imageFileId: string, quad: ImageQuad | null): Promise<void> {
      await db
        .updateTable("imageFiles")
        .set({ quad, fingerprint: null })
        .where("id", "=", imageFileId)
        .execute();
    },

    async deleteById(imageId: string): Promise<void> {
      await db.deleteFrom("faceImages").where("id", "=", imageId).execute();
    },

    async getImageFileId(imageId: string): Promise<string | undefined> {
      const row = await db
        .selectFrom("faceImages")
        .select("imageFileId")
        .where("id", "=", imageId)
        .executeTakeFirst();
      return row?.imageFileId;
    },

    async updateRehostedUrl(imageFileId: string, rehostedUrl: string | null): Promise<void> {
      await db
        .updateTable("imageFiles")
        .set({ rehostedUrl, fingerprint: null })
        .where("id", "=", imageFileId)
        .execute();
    },

    listRehostedWithoutFingerprint(limit: number): Promise<{ id: string; rehostedUrl: string }[]> {
      return db
        .selectFrom("imageFiles")
        .select(["id", "rehostedUrl"])
        .where("rehostedUrl", "is not", null)
        .where("fingerprint", "is", null)
        .orderBy("id")
        .limit(limit)
        .$narrowType<{ rehostedUrl: string }>()
        .execute();
    },

    async setFingerprint(imageFileId: string, fingerprint: string): Promise<void> {
      await db
        .updateTable("imageFiles")
        .set({ fingerprint })
        .where("id", "=", imageFileId)
        .execute();
    },

    async setActive(imageId: string, active: boolean): Promise<void> {
      await db
        .updateTable("faceImages")
        .set({ isActive: active })
        .where("id", "=", imageId)
        .execute();
    },

    async faceIdOfImage(imageId: string): Promise<string | undefined> {
      const row = await db
        .selectFrom("faceImages")
        .select("faceId")
        .where("id", "=", imageId)
        .executeTakeFirst();
      return row?.faceId;
    },

    /** The image's side as `printingId` shows it; undefined when that printing doesn't show it. */
    async sideOnPrinting(imageId: string, printingId: string): Promise<CardFace | undefined> {
      const row = await db
        .selectFrom("faceImages as fi")
        .innerJoin("printings as p", (join) =>
          join
            .on("p.id", "=", printingId)
            .on((eb) =>
              eb.or([
                eb("p.face1Id", "=", eb.ref("fi.faceId")),
                eb("p.face2Id", "=", eb.ref("fi.faceId")),
              ]),
            ),
        )
        .select(["fi.faceId", "p.face2Id"])
        .where("fi.id", "=", imageId)
        .executeTakeFirst();
      if (!row) {
        return undefined;
      }
      return row.face2Id === row.faceId ? "back" : "front";
    },

    async setFace(imageId: string, face: CardFace, printingId: string): Promise<void> {
      const image = await db
        .selectFrom("faceImages as fi")
        .select(["fi.faceId"])
        .where("fi.id", "=", imageId)
        .executeTakeFirstOrThrow();
      const targetFaceId = await requireFaceId(printingId, face);
      if (targetFaceId === image.faceId) {
        return;
      }
      await db
        .updateTable("faceImages")
        .set({
          faceId: targetFaceId,
          isActive: sql<boolean>`is_active AND NOT EXISTS (
            SELECT 1 FROM face_images other
            WHERE other.face_id = ${targetFaceId}
              AND other.is_active
              AND other.id <> face_images.id
          )`,
        })
        .where("id", "=", imageId)
        .execute();
    },

    async sideOfFace(printingId: string, faceId: string): Promise<CardFace> {
      const row = await db
        .selectFrom("printings")
        .select("face2Id")
        .where("id", "=", printingId)
        .executeTakeFirstOrThrow();
      return row.face2Id === faceId ? "back" : "front";
    },

    async deactivateActiveFace(printingId: string, face: CardFace = "front"): Promise<void> {
      await db
        .updateTable("faceImages")
        .set({ isActive: false })
        .where("faceId", "=", await requireFaceId(printingId, face))
        .where("isActive", "=", true)
        .execute();
    },

    /** The side of the linked printing whose card the candidate names; front when neither does. */
    async candidateFace(candidatePrintingId: string): Promise<CardFace> {
      const { rows } = await sql<{ face: CardFace }>`
        SELECT CASE WHEN s.position = 2 THEN 'back' ELSE 'front' END AS face
        FROM candidate_printings cp
        JOIN candidate_cards cc ON cc.id = cp.candidate_card_id
        JOIN printing_sides_ordered s ON s.printing_id = cp.printing_id
        WHERE cp.id = ${candidatePrintingId}
        ORDER BY
          EXISTS (
            SELECT 1 FROM card_name_aliases a
            WHERE a.card_id = s.card_id AND a.norm_name = cc.norm_name
          ) DESC,
          upper(s.short_code) = upper(cp.short_code) DESC,
          s.position
        LIMIT 1
      `.execute(db);
      return rows[0]?.face ?? "front";
    },

    async insertImage(
      printingId: string,
      imageUrl: string | null,
      mode: "main" | "additional" = "main",
      face: CardFace = "front",
    ): Promise<string | null> {
      if (!imageUrl) {
        return null;
      }

      const imageFileId = await findOrCreateImageFile(imageUrl);

      if (mode === "main") {
        await this.deactivateActiveFace(printingId, face);
      }

      const row = await db
        .insertInto("faceImages")
        .values({
          faceId: await requireFaceId(printingId, face),
          imageFileId,
          isActive: mode === "main",
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return row.id;
    },

    async insertUploadedImage(values: {
      id: string;
      printingId: string;
      rehostedUrl: string;
      mode: "main" | "additional";
      face?: CardFace;
      credit?: string;
    }): Promise<void> {
      const face = values.face ?? "front";
      if (values.mode === "main") {
        await this.deactivateActiveFace(values.printingId, face);
      }

      // The image_files id must equal values.id (= the file path basename):
      // regenerateFromOrig derives the on-disk lookup path from image_file.id.
      await db
        .insertInto("imageFiles")
        .values({
          id: values.id,
          rehostedUrl: values.rehostedUrl,
          credit: values.credit ?? null,
        })
        .execute();

      await db
        .insertInto("faceImages")
        .values({
          id: values.id,
          faceId: await requireFaceId(values.printingId, face),
          isActive: values.mode === "main",
          imageFileId: values.id,
        })
        .execute();
    },

    async clearAllRehostedUrls(): Promise<number> {
      const result = await db
        .updateTable("imageFiles")
        .set({ rehostedUrl: null })
        .where("rehostedUrl", "is not", null)
        .where("originalUrl", "is not", null)
        .executeTakeFirstOrThrow();
      return Number(result.numUpdatedRows);
    },

    listUnrehosted(limit: number) {
      return db
        .selectFrom("faceImages as pi")
        .innerJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId")
        .select([
          "imgf.id as imageId",
          "imgf.originalUrl",
          "imgf.rotation",
          "imgf.needsTrim",
          "imgf.quad",
        ])
        .where("imgf.rehostedUrl", "is", null)
        .where("imgf.originalUrl", "is not", null)
        .groupBy(["imgf.id", "imgf.originalUrl", "imgf.rotation", "imgf.needsTrim", "imgf.quad"])
        .limit(limit)
        .execute();
    },

    rehostStatusBySet() {
      return db
        .selectFrom("faces")
        .innerJoin("sets", "sets.id", "faces.setId")
        .leftJoin("faceImages as pi", "pi.faceId", "faces.id")
        .leftJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId")
        .select([
          "sets.slug as setId",
          "sets.name as setName",
          (eb) =>
            eb
              .cast<number>(
                eb.fn
                  .count("pi.id")
                  .filterWhere((wb) =>
                    wb.or([
                      wb("imgf.originalUrl", "is not", null),
                      wb("imgf.rehostedUrl", "is not", null),
                    ]),
                  ),
                "integer",
              )
              .as("total"),
          (eb) =>
            eb
              .cast<number>(
                eb.fn.count("pi.id").filterWhere("imgf.rehostedUrl", "is not", null),
                "integer",
              )
              .as("rehosted"),
        ])
        .groupBy(["sets.slug", "sets.name"])
        .orderBy("sets.name")
        .execute();
    },

    /**
     * `scansOnly` keeps only images with `needs_trim` set — the scanned
     * uploads whose variants the crop/contrast pipeline touches.
     */
    listAllRehosted(scansOnly = false) {
      return db
        .selectFrom("imageFiles as imgf")
        .select(["imgf.id as imageId", "imgf.rehostedUrl"])
        .where("imgf.rehostedUrl", "is not", null)
        .$if(scansOnly, (qb) => qb.where("imgf.needsTrim", "=", true))
        .orderBy("imgf.id")
        .$narrowType<{ rehostedUrl: string }>()
        .execute();
    },

    getImageFileById(imageFileId: string): Promise<
      | {
          id: string;
          originalUrl: string | null;
          rehostedUrl: string | null;
          rotation: 0 | 90 | 180 | 270;
          needsTrim: boolean;
          quad: ImageQuad | null;
        }
      | undefined
    > {
      return db
        .selectFrom("imageFiles")
        .select(["id", "originalUrl", "rehostedUrl", "rotation", "needsTrim", "quad"])
        .where("id", "=", imageFileId)
        .executeTakeFirst();
    },

    /**
     * Guards file deletion: disk files are only removed when no *other*
     * face image still points at the same image_file.
     */
    async countOthersByImageFileId(
      imageFileId: string,
      excludePrintingImageId: string,
    ): Promise<number> {
      const result = await db
        .selectFrom("faceImages")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("imageFileId", "=", imageFileId)
        .where("id", "!=", excludePrintingImageId)
        .executeTakeFirstOrThrow();
      return Number(result.count);
    },

    listAllRehostedWithContext() {
      return db
        .selectFrom("imageFiles as imgf")
        .innerJoin("faceImages as pi", "pi.imageFileId", "imgf.id")
        .innerJoin("faces as p", "p.id", "pi.faceId")
        .innerJoin("sets as s", "s.id", "p.setId")
        .innerJoin("cards as c", "c.id", "p.cardId")
        .select([
          "imgf.id as imageId",
          "imgf.rehostedUrl",
          "imgf.originalUrl",
          "c.slug as cardSlug",
          "c.name as cardName",
          "p.shortCode as printingShortCode",
          "s.slug as setSlug",
        ])
        .where("imgf.rehostedUrl", "is not", null)
        .groupBy([
          "imgf.id",
          "imgf.rehostedUrl",
          "imgf.originalUrl",
          "c.slug",
          "c.name",
          "p.shortCode",
          "s.slug",
        ])
        .orderBy("s.slug")
        .orderBy("c.name")
        .$narrowType<{ rehostedUrl: string }>()
        .execute();
    },

    async allRehostedUrls(): Promise<string[]> {
      const rows = await db
        .selectFrom("imageFiles")
        .select("rehostedUrl")
        .where("rehostedUrl", "is not", null)
        .$narrowType<{ rehostedUrl: string }>()
        .execute();
      return rows.map((r) => r.rehostedUrl);
    },

    async faceForShortCode(printingId: string, shortCode: string): Promise<CardFace> {
      const row = await db
        .selectFrom("printings as p")
        .innerJoin("faces as f1", "f1.id", "p.face1Id")
        .leftJoin("faces as f2", "f2.id", "p.face2Id")
        .select(["f1.shortCode as frontShortCode", "f2.shortCode as backShortCode"])
        .where("p.id", "=", printingId)
        .executeTakeFirst();
      const code = shortCode.toUpperCase();
      return row?.backShortCode?.toUpperCase() === code && row.frontShortCode.toUpperCase() !== code
        ? "back"
        : "front";
    },

    getCandidatePrintingById(id: string) {
      return db
        .selectFrom("candidatePrintings")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
    },

    /**
     * How many faces pin this image file as their substitute art.
     * Deleting a face image consults this before removing the files behind
     * it: the `face_images` row is going, but a pin on the same
     * `image_files` row keeps the file on screen somewhere else.
     */
    async countPinsByImageFileId(imageFileId: string): Promise<number> {
      const row = await db
        .selectFrom("faces")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("fallbackImageFileId", "=", imageFileId)
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },

    getFallbackArt(
      printingId: string,
      face: CardFace = "front",
    ): Promise<
      | {
          id: string;
          shortCode: string;
          fallbackArtMode: FallbackArtMode;
          fallbackImageFileId: string | null;
        }
      | undefined
    > {
      return db
        .selectFrom("printings as p")
        .innerJoin("faces as f", "f.id", face === "back" ? "p.face2Id" : "p.face1Id")
        .select(["p.id", "f.shortCode", "f.fallbackArtMode", "f.fallbackImageFileId"])
        .where("p.id", "=", printingId)
        .executeTakeFirst();
    },

    async setFallbackArt(
      printingId: string,
      mode: FallbackArtMode,
      imageFileId: string | null,
      face: CardFace = "front",
    ): Promise<void> {
      await db
        .updateTable("faces")
        .set({
          fallbackArtMode: mode,
          fallbackImageFileId: mode === "pinned" ? imageFileId : null,
        })
        .where("id", "=", await requireFaceId(printingId, face))
        .execute();
    },

    /**
     * Shares {@link findOrCreateImageFile} with the face-image path, so pinning
     * art already stored under another face reuses that row instead of
     * duplicating the file.
     */
    imageFileForUrl(originalUrl: string): Promise<string> {
      return findOrCreateImageFile(originalUrl);
    },

    async originalUrlsInUse(originalUrls: string[]): Promise<Set<string>> {
      if (originalUrls.length === 0) {
        return new Set();
      }
      const rows = await db
        .selectFrom("imageFiles")
        .select("originalUrl")
        .where("originalUrl", "in", originalUrls)
        .execute();
      return new Set(rows.map((row) => row.originalUrl as string));
    },

    /**
     * The unattached row is the point: a file pinned as substitute art is not a
     * scan of the face that shows it, and giving it a `face_images` row
     * would make the face look scanned to the missing-images report, the
     * contribute prompt and the catalog alike. Same id-equals-path-basename rule
     * as {@link insertUploadedImage}, which `regenerateFromOrig` depends on.
     */
    async insertUnattachedImageFile(values: { id: string; rehostedUrl: string }): Promise<void> {
      await db
        .insertInto("imageFiles")
        .values({ id: values.id, rehostedUrl: values.rehostedUrl })
        .execute();
    },

    getImageFileForRehost(imageFileId: string): Promise<
      | {
          id: string;
          originalUrl: string | null;
          rehostedUrl: string | null;
          rotation: number;
          needsTrim: boolean;
          quad: ImageQuad | null;
        }
      | undefined
    > {
      return db
        .selectFrom("imageFiles")
        .select(["id", "originalUrl", "rehostedUrl", "rotation", "needsTrim", "quad"])
        .where("id", "=", imageFileId)
        .executeTakeFirst();
    },

    /**
     * Delete orphaned image_files rows that nothing references — neither a
     * face_images row nor a face's pinned fallback art. A pinned file
     * usually *is* some face's image too, but one uploaded purely as a
     * substitute is not, and it is exactly as live as any other.
     */
    async deleteOrphanedImageFiles(): Promise<number> {
      const result = await db
        .deleteFrom("imageFiles")
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("faceImages")
                .select("faceImages.id")
                .whereRef("faceImages.imageFileId", "=", "imageFiles.id"),
            ),
          ),
        )
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("faces")
                .select("faces.id")
                .whereRef("faces.fallbackImageFileId", "=", "imageFiles.id"),
            ),
          ),
        )
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
  };
}
