import type { Kysely } from "kysely";

import type { Database } from "../db/tables.js";
import { deletePrintingsByFace, insertCard, insertPrinting } from "./integration-context.js";

export interface SeededPrinting {
  setId: string;
  cardId: string;
  cardSlug: string;
  cardNormName: string;
  printingId: string;
  faceId: string;
  /** Removes the printing, its card and its set. */
  cleanup: () => Promise<void>;
}

/** One set, one card and one English printing, all keyed by `tag` so files never collide. */
export async function seedCatalogPrinting(
  db: Kysely<Database>,
  tag: string,
): Promise<SeededPrinting> {
  const slug = `${tag}-${crypto.randomUUID().slice(0, 8)}`;
  const set = await db
    .insertInto("sets")
    .values({ slug, name: `Set ${slug}`, printedTotal: 1 })
    .returning("id")
    .executeTakeFirstOrThrow();
  const name = `Card ${slug}`;
  const normName = name.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
  const card = await insertCard(db, { slug, name, normName });
  const printing = await insertPrinting(db, {
    cardId: card.id,
    setId: set.id,
    shortCode: `${slug}-001`,
    publicCode: `${slug}-001`,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    finish: "normal",
    size: "standard",
    language: "EN",
    artist: "Test Artist",
  });
  return {
    setId: set.id,
    cardId: card.id,
    cardSlug: slug,
    cardNormName: normName,
    printingId: printing.id,
    faceId: printing.faceId,
    cleanup: async () => {
      await deletePrintingsByFace(db, "setId", "=", set.id);
      await db.deleteFrom("cards").where("id", "=", card.id).execute();
      await db.deleteFrom("sets").where("id", "=", set.id).execute();
    },
  };
}
