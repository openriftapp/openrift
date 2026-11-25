import { todayUtc } from "@openrift/shared/format-date";
import { cardIdsBannedIn } from "@openrift/shared/format-legality";
import { WellKnown } from "@openrift/shared/well-known";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, insertCards } from "../../../test/integration-context.js";
import { cardBansRepo } from "./card-bans.js";

const ctx = createDbContext("00000000-0000-4000-a000-0000000000cb");
const SLUG_PREFIX = "cban-asof-";
const CONSTRUCTED = WellKnown.banFormat.CONSTRUCTED;

describe.skipIf(!ctx)("cardBansRepo.listForCards (integration)", () => {
  const { db } = ctx!;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    const cards = await insertCards(
      db,
      ["lifted-after", "lifted-on-day", "starts-after", "still-banned", "lifted-in-korea"].map(
        (key) => ({ slug: `${SLUG_PREFIX}${key}`, name: `Ban As Of ${key}` }),
      ),
    );
    for (const card of cards) {
      ids.set(card.slug.slice(SLUG_PREFIX.length), card.id);
    }
    const ban = (
      key: string,
      bannedAt: string | null,
      unbannedAt: string | null,
      circuit: string | null = null,
    ) => ({
      cardId: ids.get(key)!,
      formatId: CONSTRUCTED,
      circuit,
      bannedAt,
      unbannedAt,
      reason: null,
    });
    await db
      .insertInto("cardBans")
      .values([
        ban("lifted-after", "2026-09-01", "2026-09-25"),
        ban("lifted-on-day", "2026-09-01", "2026-09-20"),
        ban("starts-after", "2026-09-21", null),
        ban("still-banned", "2026-09-01", null),
        ban("lifted-in-korea", "2026-09-01", null),
        ban("lifted-in-korea", "2026-09-01", "2026-09-10", "korea"),
        ban("lifted-in-korea", null, null, "korea"),
        ban("still-banned", null, null, "traditional-chinese"),
      ])
      .execute();
  });

  afterAll(async () => {
    const cardIds = [...ids.values()];
    if (cardIds.length > 0) {
      await db.deleteFrom("cardBans").where("cardId", "in", cardIds).execute();
      await db.deleteFrom("cards").where("id", "in", cardIds).execute();
    }
  });

  it("returns global rows only without a circuit", async () => {
    const rows = await cardBansRepo(db).listForCards([...ids.values()], [CONSTRUCTED]);

    expect(rows.every((row) => row.circuit === null)).toBe(true);
    expect(cardIdsBannedIn(rows, CONSTRUCTED, { day: "2026-09-20" })).toEqual(
      new Set([ids.get("lifted-after"), ids.get("still-banned"), ids.get("lifted-in-korea")]),
    );
  });

  it("copies the global history into a circuit's first row, up to today", async () => {
    const cardId = ids.get("still-banned")!;
    await cardBansRepo(db).create({
      cardId,
      formatId: CONSTRUCTED,
      circuit: "china",
      bannedAt: null,
      reason: null,
    });
    const rows = await db
      .selectFrom("cardBans")
      .select(["bannedAt", "unbannedAt"])
      .where("cardId", "=", cardId)
      .where("circuit", "=", "china")
      .orderBy("bannedAt")
      .execute();

    expect(rows).toEqual([
      { bannedAt: "2026-09-01", unbannedAt: todayUtc() },
      { bannedAt: null, unbannedAt: null },
    ]);
  });

  it("deletes a ban that has not started yet instead of lifting it", async () => {
    const cardId = ids.get("starts-after")!;
    await db
      .updateTable("cardBans")
      .set({ bannedAt: "2099-01-01" })
      .where("cardId", "=", cardId)
      .execute();

    expect(await cardBansRepo(db).unban(cardId, CONSTRUCTED, null)).toBe(true);
    const rows = await db
      .selectFrom("cardBans")
      .select("id")
      .where("cardId", "=", cardId)
      .execute();
    expect(rows).toEqual([]);
  });

  it("adds the circuit's rows, which replace the global ones there", async () => {
    const rows = await cardBansRepo(db).listForCards([...ids.values()], [CONSTRUCTED], "korea");

    expect(rows.some((row) => row.circuit === "traditional-chinese")).toBe(false);
    expect(
      cardIdsBannedIn(rows, CONSTRUCTED, { circuit: "korea", day: "2026-09-20" }).has(
        ids.get("lifted-in-korea")!,
      ),
    ).toBe(false);
  });
});
