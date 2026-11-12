import { getOrientation } from "@openrift/shared/card-orientation";
import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type { CardFace, FallbackArtMode } from "@openrift/shared/types/enums";
import type { Kysely, RawBuilder } from "kysely";
import { sql } from "kysely";

import { cardTypes } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import { candidateSideOrder } from "../../../repositories/candidate-card-sql.js";
import { inTransaction } from "../../../repositories/query-helpers.js";

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

  async function lockFace(conn: Kysely<Database>, faceId: string): Promise<void> {
    await conn.selectFrom("faces").select("id").where("id", "=", faceId).forUpdate().execute();
  }

  async function clearPendingOnFace(conn: Kysely<Database>, faceId: string): Promise<void> {
    await conn
      .updateTable("faceImages")
      .set({ activateWhenRehosted: false })
      .where("faceId", "=", faceId)
      .where("activateWhenRehosted", "=", true)
      .execute();
  }

  async function deactivateFace(conn: Kysely<Database>, faceId: string): Promise<void> {
    await lockFace(conn, faceId);
    await clearPendingOnFace(conn, faceId);
    await conn
      .updateTable("faceImages")
      .set({ isActive: false })
      .where("faceId", "=", faceId)
      .where("isActive", "=", true)
      .execute();
  }

  async function requireImageFaceId(imageId: string): Promise<string> {
    const row = await db
      .selectFrom("faceImages")
      .select("faceId")
      .where("id", "=", imageId)
      .executeTakeFirstOrThrow();
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

    getForActivate(imageId: string) {
      return db
        .selectFrom("faceImages as fi")
        .innerJoin("imageFiles as imgf", "imgf.id", "fi.imageFileId")
        .select([
          "fi.id",
          "fi.imageFileId",
          IMAGE_PRINTING_ID.as("printingId"),
          IMAGE_FACE.as("face"),
          "imgf.rehostedUrl",
        ])
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
          "imgf.rehostedUrl",
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
      await inTransaction(db, async (trx) => {
        const row = await trx
          .selectFrom("faceImages")
          .select("faceId")
          .where("id", "=", imageId)
          .executeTakeFirst();
        if (!row) {
          return;
        }
        await lockFace(trx, row.faceId);
        await trx.deleteFrom("faceImages").where("id", "=", imageId).execute();
      });
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
          activateWhenRehosted: sql<boolean>`activate_when_rehosted AND NOT EXISTS (
            SELECT 1 FROM face_images other
            WHERE other.face_id = ${targetFaceId}
              AND other.activate_when_rehosted
              AND other.id <> face_images.id
          )`,
        })
        .where("id", "=", imageId)
        .execute();
    },

    /** Call inside a transaction. */
    async deactivateActiveFace(printingId: string, face: CardFace = "front"): Promise<void> {
      await deactivateFace(db, await requireFaceId(printingId, face));
    },

    /** The side of the linked printing whose card the candidate names; front when neither does. */
    async candidateFace(candidatePrintingId: string): Promise<CardFace> {
      const { rows } = await sql<{ face: CardFace }>`
        SELECT CASE WHEN s.position = 2 THEN 'back' ELSE 'front' END AS face
        FROM candidate_printings cp
        JOIN candidate_cards cc ON cc.id = cp.candidate_card_id
        JOIN printing_sides_ordered s ON s.printing_id = cp.printing_id
        WHERE cp.id = ${candidatePrintingId}
        ORDER BY ${candidateSideOrder(
          {
            cardId: sql.ref("s.card_id"),
            shortCode: sql.ref("s.short_code"),
            isFirst: sql`s.position = 1`,
          },
          { normName: sql.ref("cc.norm_name"), shortCode: sql.ref("cp.short_code") },
        )}
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
      const faceId = await requireFaceId(printingId, face);

      return inTransaction(db, async (trx) => {
        const file = await trx
          .selectFrom("imageFiles")
          .select("rehostedUrl")
          .where("id", "=", imageFileId)
          .forShare()
          .executeTakeFirstOrThrow();
        const activateNow = mode === "main" && file.rehostedUrl !== null;
        const pending = mode === "main" && file.rehostedUrl === null;
        if (activateNow) {
          await deactivateFace(trx, faceId);
        } else if (pending) {
          await lockFace(trx, faceId);
          await clearPendingOnFace(trx, faceId);
        }
        const row = await trx
          .insertInto("faceImages")
          .values({ faceId, imageFileId, isActive: activateNow, activateWhenRehosted: pending })
          .returning("id")
          .executeTakeFirstOrThrow();
        return row.id;
      });
    },

    /** Call inside a transaction. */
    async markPending(imageId: string): Promise<void> {
      const faceId = await requireImageFaceId(imageId);
      await lockFace(db, faceId);
      await clearPendingOnFace(db, faceId);
      await db
        .updateTable("faceImages")
        .set({ activateWhenRehosted: true })
        .where("id", "=", imageId)
        .where("isActive", "=", false)
        .execute();
    },

    async clearPending(imageId: string): Promise<void> {
      await db
        .updateTable("faceImages")
        .set({ activateWhenRehosted: false })
        .where("id", "=", imageId)
        .execute();
    },

    async promotePending(imageFileId: string): Promise<void> {
      const faces = await db
        .selectFrom("faceImages")
        .select("faceId")
        .where("imageFileId", "=", imageFileId)
        .where("activateWhenRehosted", "=", true)
        .distinct()
        .orderBy("faceId")
        .execute();
      for (const { faceId } of faces) {
        await lockFace(db, faceId);
        const claimed = await db
          .updateTable("faceImages")
          .set({ activateWhenRehosted: false })
          .where("faceId", "=", faceId)
          .where("imageFileId", "=", imageFileId)
          .where("activateWhenRehosted", "=", true)
          .returning("id")
          .executeTakeFirst();
        if (!claimed) {
          continue;
        }
        await db
          .updateTable("faceImages")
          .set({ isActive: false })
          .where("faceId", "=", faceId)
          .where("isActive", "=", true)
          .execute();
        await db
          .updateTable("faceImages")
          .set({ isActive: true })
          .where("id", "=", claimed.id)
          .execute();
      }
    },

    completeRehost(imageFileId: string, rehostedUrl: string): Promise<boolean> {
      return inTransaction(db, async (trx) => {
        const updated = await trx
          .updateTable("imageFiles")
          .set({ rehostedUrl, fingerprint: null })
          .where("id", "=", imageFileId)
          .executeTakeFirst();
        if (updated.numUpdatedRows === 0n) {
          return false;
        }
        const repo = printingImagesRepo(trx);
        await repo.promotePending(imageFileId);
        await repo.clearRehostFailure(imageFileId);
        return true;
      });
    },

    async promoteRehosted(imageFileId: string): Promise<void> {
      await inTransaction(db, async (trx) => {
        const repo = printingImagesRepo(trx);
        await repo.promotePending(imageFileId);
        await repo.clearRehostFailure(imageFileId);
      });
    },

    async clearPendingForFile(imageFileId: string): Promise<void> {
      await db
        .updateTable("faceImages")
        .set({ activateWhenRehosted: false })
        .where("imageFileId", "=", imageFileId)
        .where("activateWhenRehosted", "=", true)
        .execute();
    },

    async isPinnedFallbackFile(imageFileId: string): Promise<boolean> {
      const row = await db
        .selectFrom("faces")
        .select("id")
        .where("fallbackImageFileId", "=", imageFileId)
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },

    async recordRehostFailure(imageFileId: string, error: string): Promise<void> {
      await db
        .insertInto("imageRehostFailures")
        .values({ imageFileId, attempts: 1, lastError: error })
        .onConflict((oc) =>
          oc.column("imageFileId").doUpdateSet({
            attempts: sql<number>`image_rehost_failures.attempts + 1`,
            lastError: error,
            lastAttemptAt: sql<Date>`now()`,
          }),
        )
        .execute();
    },

    async countRehostFailures(): Promise<{ retrying: number; manual: number }> {
      const { rows } = await sql<{ retrying: number; manual: number }>`
        WITH classified AS (
          SELECT
            f.rehosted_url IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM face_images fi
                  WHERE fi.image_file_id = f.id AND fi.activate_when_rehosted
                )
                OR EXISTS (SELECT 1 FROM faces fc WHERE fc.fallback_image_file_id = f.id)
              ) AS retrying
          FROM image_rehost_failures rf
          JOIN image_files f ON f.id = rf.image_file_id
        )
        SELECT
          count(*) FILTER (WHERE retrying)::int AS retrying,
          count(*) FILTER (WHERE NOT retrying)::int AS manual
        FROM classified
      `.execute(db);
      return rows[0] ?? { retrying: 0, manual: 0 };
    },

    async clearRehostFailure(imageFileId: string): Promise<void> {
      await db.deleteFrom("imageRehostFailures").where("imageFileId", "=", imageFileId).execute();
    },

    async insertUploadedImage(values: {
      id: string;
      printingId: string;
      rehostedUrl: string;
      mode: "main" | "additional";
      face?: CardFace;
      credit?: string;
    }): Promise<void> {
      const faceId = await requireFaceId(values.printingId, values.face ?? "front");
      await inTransaction(db, async (trx) => {
        if (values.mode === "main") {
          await deactivateFace(trx, faceId);
        }

        // The image_files id must equal values.id (= the file path basename):
        // regenerateFromOrig derives the on-disk lookup path from image_file.id.
        await trx
          .insertInto("imageFiles")
          .values({
            id: values.id,
            rehostedUrl: values.rehostedUrl,
            credit: values.credit ?? null,
          })
          .execute();

        await trx
          .insertInto("faceImages")
          .values({
            id: values.id,
            faceId,
            isActive: values.mode === "main",
            imageFileId: values.id,
          })
          .execute();
      });
    },

    async isActiveImageFile(imageFileId: string): Promise<boolean> {
      const row = await db
        .selectFrom("faceImages")
        .select("id")
        .where("imageFileId", "=", imageFileId)
        .where("isActive", "=", true)
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },

    async listDueRehosts(limit: number): Promise<string[]> {
      const { rows } = await sql<{ id: string }>`
        SELECT f.id
        FROM image_files f
        LEFT JOIN image_rehost_failures rf ON rf.image_file_id = f.id
        WHERE (
            f.rehosted_url IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM face_images fi
              WHERE fi.image_file_id = f.id AND fi.activate_when_rehosted
            )
          )
          OR (
            f.rehosted_url IS NULL
            AND f.original_url IS NOT NULL
            AND (
              EXISTS (
                SELECT 1 FROM face_images fi
                WHERE fi.image_file_id = f.id AND fi.activate_when_rehosted
              )
              OR EXISTS (SELECT 1 FROM faces fc WHERE fc.fallback_image_file_id = f.id)
            )
            AND (
              rf.image_file_id IS NULL
              OR date_trunc('milliseconds', rf.last_attempt_at) < now() - least(
                interval '1 hour' * power(2, least(rf.attempts - 1, 10)),
                interval '1 day'
              )
            )
          )
        ORDER BY rf.last_attempt_at ASC NULLS FIRST, f.id
        LIMIT ${limit}
      `.execute(db);
      return rows.map((row) => row.id);
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

    async linkedImageAttached(candidateCardId: string): Promise<boolean> {
      const row = await db
        .selectFrom("candidatePrintings as cp")
        .innerJoin("printings as p", "p.id", "cp.printingId")
        .innerJoin("faceImages as fi", (join) =>
          join.on((eb) =>
            eb.or([
              eb("fi.faceId", "=", eb.ref("p.face1Id")),
              eb("fi.faceId", "=", eb.ref("p.face2Id")),
            ]),
          ),
        )
        .innerJoin("imageFiles as imgf", "imgf.id", "fi.imageFileId")
        .select("cp.id")
        .where("cp.candidateCardId", "=", candidateCardId)
        .whereRef("imgf.originalUrl", "=", "cp.imageUrl")
        .whereRef("fi.createdAt", ">=", "cp.createdAt")
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },

    getCandidatePrintingById(id: string) {
      return db
        .selectFrom("candidatePrintings")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
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
  };
}
