import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

const CLAIM_WINDOW = sql`interval '24 hours'`;

export function referralsRepo(db: Kysely<Database>) {
  async function getCode(userId: string): Promise<string | null> {
    const row = await db
      .selectFrom("users")
      .select("referralCode")
      .where("id", "=", userId)
      .executeTakeFirst();
    return row?.referralCode ?? null;
  }

  return {
    getCode,

    async setCodeIfMissing(userId: string, code: string): Promise<string | null> {
      const updated = await db
        .updateTable("users")
        .set({ referralCode: code })
        .where("id", "=", userId)
        .where("referralCode", "is", null)
        .returning("referralCode")
        .executeTakeFirst();
      if (updated) {
        return updated.referralCode;
      }
      return getCode(userId);
    },

    /** @returns Whether the referral was recorded. A set referrer or an old account refuses it. */
    async claim(userId: string, code: string): Promise<boolean> {
      const result = await db
        .updateTable("users as u")
        .set((eb) => ({
          referredBy: eb
            .selectFrom("users as r")
            .select("r.id")
            .where("r.referralCode", "=", code)
            .where("r.id", "<>", userId),
        }))
        .where("u.id", "=", userId)
        .where("u.referredBy", "is", null)
        .where(sql<boolean>`u.created_at > now() - ${CLAIM_WINDOW}`)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("users as r")
              .select("r.id")
              .where("r.referralCode", "=", code)
              .where("r.id", "<>", userId),
          ),
        )
        .executeTakeFirst();
      return (result.numUpdatedRows ?? 0n) > 0n;
    },

    /**
     * `counted` needs a verified email plus a card in a collection or a deck,
     * so empty throwaway accounts do not raise anyone's tier.
     */
    async counts(referrerId: string): Promise<{ signedUp: number; counted: number }> {
      const row = await db
        .selectFrom("users as u")
        .select((eb) => [
          eb.cast<number>(eb.fn.countAll(), "integer").as("signedUp"),
          eb
            .cast<number>(
              eb.fn
                .count("u.id")
                .filterWhere((fw) =>
                  fw.and([
                    fw("u.emailVerified", "=", true),
                    fw.or([
                      fw.exists(
                        fw
                          .selectFrom("copies as c")
                          .innerJoin("collections as col", "col.id", "c.collectionId")
                          .select("c.id")
                          .whereRef("col.userId", "=", "u.id"),
                      ),
                      fw.exists(
                        fw
                          .selectFrom("decks as d")
                          .select("d.id")
                          .whereRef("d.userId", "=", "u.id"),
                      ),
                    ]),
                  ]),
                ),
              "integer",
            )
            .as("counted"),
        ])
        .where("u.referredBy", "=", referrerId)
        .executeTakeFirstOrThrow();
      return { signedUp: row.signedUp, counted: row.counted };
    },
  };
}
