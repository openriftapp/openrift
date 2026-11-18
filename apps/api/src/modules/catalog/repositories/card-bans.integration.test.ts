import { WellKnown } from "@openrift/shared/well-known";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, insertCards } from "../../../test/integration-context.js";
import { cardBansRepo } from "./card-bans.js";

const ctx = createDbContext("00000000-0000-4000-a000-0000000000cb");
const SLUG_PREFIX = "cban-asof-";
const CONSTRUCTED = WellKnown.banFormat.CONSTRUCTED;

describe.skipIf(!ctx)("cardBansRepo.listInEffectForCards (integration)", () => {
  const { db } = ctx!;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    const cards = await insertCards(
      db,
      ["lifted-after", "lifted-on-day", "starts-after", "still-banned"].map((key) => ({
        slug: `${SLUG_PREFIX}${key}`,
        name: `Ban As Of ${key}`,
      })),
    );
    for (const card of cards) {
      ids.set(card.slug.slice(SLUG_PREFIX.length), card.id);
    }
    const ban = (key: string, bannedAt: string, unbannedAt: string | null) => ({
      cardId: ids.get(key)!,
      formatId: CONSTRUCTED,
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

  it("returns the bans in effect on the day, lifted ones included", async () => {
    const rows = await cardBansRepo(db).listInEffectForCards(
      [...ids.values()],
      [CONSTRUCTED],
      "2026-09-20",
    );

    expect(rows.map((row) => row.cardId).toSorted()).toEqual(
      [ids.get("lifted-after"), ids.get("still-banned")].toSorted(),
    );
  });
});
