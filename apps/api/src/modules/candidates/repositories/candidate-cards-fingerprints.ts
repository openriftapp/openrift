import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { candidateSideOrder } from "../../../repositories/candidate-card-sql.js";
import { retryBackoffDue } from "../../../repositories/query-helpers.js";

export interface CandidatePrintingToFingerprint {
  id: string;
  imageUrl: string;
  liveFingerprint: string | null;
}

export function candidateFingerprintsRepo(db: Kysely<Database>) {
  return {
    listPrintingsNeedingFingerprint(limit: number): Promise<CandidatePrintingToFingerprint[]> {
      return db
        .selectFrom("candidatePrintings as cp")
        .leftJoin("candidateFingerprintFailures as ff", (join) =>
          join
            .onRef("ff.candidatePrintingId", "=", "cp.id")
            .onRef("ff.imageUrl", "=", "cp.imageUrl"),
        )
        .select((eb) => [
          "cp.id",
          "cp.imageUrl",
          // The side whose card the candidate names; side 1 when neither does.
          eb
            .selectFrom("printingSidesOrdered as s")
            .innerJoin("faceImages as pi", "pi.faceId", "s.faceId")
            .innerJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId")
            .select("imgf.fingerprint")
            .whereRef("s.printingId", "=", "cp.printingId")
            .where("pi.isActive", "=", true)
            .where("imgf.fingerprint", "is not", null)
            .orderBy(
              candidateSideOrder(
                {
                  cardId: sql.ref("s.cardId"),
                  shortCode: sql.ref("s.shortCode"),
                  isFirst: sql`${sql.ref("s.position")} = 1`,
                },
                {
                  normName: sql`(select cc.norm_name from candidate_cards cc where cc.id = ${sql.ref("cp.candidateCardId")})`,
                  shortCode: sql.ref("cp.shortCode"),
                },
              ),
            )
            .limit(1)
            .as("liveFingerprint"),
        ])
        .where("cp.imageUrl", "is not", null)
        .where("cp.printingId", "is not", null)
        .where((eb) =>
          eb.or([
            eb("cp.imageFingerprintUrl", "is", null),
            eb("cp.imageFingerprintUrl", "!=", eb.ref("cp.imageUrl")),
          ]),
        )
        .where(retryBackoffDue("ff"))
        .orderBy(sql`ff.last_attempt_at asc nulls first`)
        .orderBy("cp.id")
        .limit(limit)
        .$narrowType<{ imageUrl: string }>()
        .execute();
    },

    /** Clears any recorded failure: the URL is settled, with or without a fingerprint. */
    async setImageFingerprint(
      id: string,
      imageUrl: string,
      fingerprint: string | null,
    ): Promise<void> {
      await db
        .with("cleared", (qb) =>
          qb.deleteFrom("candidateFingerprintFailures").where("candidatePrintingId", "=", id),
        )
        .updateTable("candidatePrintings")
        .set({ imageFingerprint: fingerprint, imageFingerprintUrl: imageUrl })
        .where("id", "=", id)
        .execute();
    },

    /** Returns the attempt count for this URL; a different URL starts over at 1. */
    async recordFingerprintFailure(id: string, imageUrl: string, error: string): Promise<number> {
      const row = await db
        .insertInto("candidateFingerprintFailures")
        .values({ candidatePrintingId: id, imageUrl, attempts: 1, lastError: error })
        .onConflict((oc) =>
          oc.column("candidatePrintingId").doUpdateSet({
            attempts: sql<number>`case when candidate_fingerprint_failures.image_url = excluded.image_url then candidate_fingerprint_failures.attempts + 1 else 1 end`,
            imageUrl,
            lastError: error,
            lastAttemptAt: sql<Date>`now()`,
          }),
        )
        .returning("attempts")
        .executeTakeFirstOrThrow();
      return row.attempts;
    },
  };
}
