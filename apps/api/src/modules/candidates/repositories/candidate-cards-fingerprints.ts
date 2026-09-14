import type { Kysely } from "kysely";

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
          eb
            .selectFrom("printingImages as pi")
            .innerJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId")
            .select("imgf.fingerprint")
            .whereRef("pi.printingId", "=", "cp.printingId")
            .where("pi.face", "=", "front")
            .where("pi.isActive", "=", true)
            .where("imgf.fingerprint", "is not", null)
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
