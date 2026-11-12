import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { candidateSideOrder } from "../../../repositories/candidate-card-sql.js";

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
        .orderBy("cp.id")
        .limit(limit)
        .$narrowType<{ imageUrl: string }>()
        .execute();
    },

    async setImageFingerprint(
      id: string,
      imageUrl: string,
      fingerprint: string | null,
    ): Promise<void> {
      await db
        .updateTable("candidatePrintings")
        .set({ imageFingerprint: fingerprint, imageFingerprintUrl: imageUrl })
        .where("id", "=", id)
        .execute();
    },
  };
}
