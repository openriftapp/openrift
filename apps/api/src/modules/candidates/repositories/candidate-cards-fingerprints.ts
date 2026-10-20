import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

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
              sql`EXISTS (
                SELECT 1 FROM card_name_aliases a
                JOIN candidate_cards cc ON cc.norm_name = a.norm_name
                WHERE a.card_id = s.card_id AND cc.id = cp.candidate_card_id
              ) DESC`,
            )
            .orderBy(sql`upper(s.short_code) = upper(cp.short_code) DESC`)
            .orderBy("s.position")
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
