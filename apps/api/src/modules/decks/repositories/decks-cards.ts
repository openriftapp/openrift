import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import { primaryCardTypeSql } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import type { CardsTable } from "../../../db/tables/catalog.js";
import type { DeckCardsTable } from "../../../db/tables/decks.js";
import { currentSafeXid, inTransaction } from "../../../repositories/query-helpers.js";

/** Slim deck card row — card metadata is resolved client-side from the catalog. */
type DeckCardRow = Pick<
  Selectable<DeckCardsTable>,
  "cardId" | "zone" | "quantity" | "preferredPrintingId"
>;

type DeckCardDetailRow = Pick<
  Selectable<DeckCardsTable>,
  "id" | "deckId" | "cardId" | "zone" | "quantity" | "preferredPrintingId"
> &
  Pick<
    Selectable<CardsTable>,
    "energy" | "might" | "power" | "maxCopiesOverride" | "additionalLegendCount"
  > & {
    cardName: string;
    cardType: CardType;
    cardTypes: CardType[];
    domains: Domain[];
    superTypes: SuperType[];
    tags: string[];
    keywords: string[];
  };

export type ReplaceDeckCardsResult =
  | { outcome: "replaced"; version: string }
  | { outcome: "missing" }
  | { outcome: "stale"; version: string; cards: DeckCardRow[] };

/** The share lock holds off writers, so the cards read belong to the version read. */
async function staleDeckCards(
  trx: Kysely<Database>,
  deckId: string,
): Promise<ReplaceDeckCardsResult> {
  const current = await trx
    .selectFrom("decks")
    .select(sql<string>`updated_xid::text`.as("version"))
    .where("id", "=", deckId)
    .forShare()
    .executeTakeFirst();
  if (!current) {
    return { outcome: "missing" };
  }
  const cards = await trx
    .selectFrom("deckCards")
    .select(["cardId", "zone", "quantity", "preferredPrintingId"])
    .where("deckId", "=", deckId)
    .execute();
  return { outcome: "stale", version: current.version, cards };
}

export function decksCardsRepo(db: Kysely<Database>) {
  return {
    cardsForDeck(deckId: string, userId: string): Promise<DeckCardRow[]> {
      return db
        .selectFrom("deckCards as dc")
        .innerJoin("decks as d", "d.id", "dc.deckId")
        .select(["dc.cardId", "dc.zone", "dc.quantity", "dc.preferredPrintingId"])
        .where("dc.deckId", "=", deckId)
        .where("d.userId", "=", userId)
        .execute();
    },

    cardsWithDetails(deckId: string, userId: string): Promise<DeckCardDetailRow[]> {
      return db
        .selectFrom("deckCards as dc")
        .innerJoin("decks as d", "d.id", "dc.deckId")
        .innerJoin("cards as c", "c.id", "dc.cardId")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "dc.cardId")
        .select([
          "dc.id",
          "dc.deckId",
          "dc.cardId",
          "dc.zone",
          "dc.quantity",
          "dc.preferredPrintingId",
          "c.name as cardName",
          primaryCardTypeSql("c.id").as("cardType"),
          "mca.types as cardTypes",
          "c.tags",
          "c.keywords",
          "c.energy",
          "c.might",
          "c.power",
          "c.maxCopiesOverride",
          "c.additionalLegendCount",
          "mca.domains",
          "mca.superTypes",
        ])
        .where("dc.deckId", "=", deckId)
        .where("d.userId", "=", userId)
        .orderBy("dc.zone")
        .orderBy("c.name")
        .execute();
    },

    currentSafeXid(): Promise<string> {
      return currentSafeXid(db);
    },

    /** The watermark filters by the deck, not the card: a touched deck returns all of its cards, so removals show as absence. */
    allDeckCardsForUser(
      userId: string,
      sinceXid?: string,
      page?: { limit: number; after?: string },
    ): Promise<
      {
        id: string;
        deckId: string;
        cardId: string;
        zone: DeckZone;
        quantity: number;
        preferredPrintingId: string | null;
      }[]
    > {
      let query = db
        .selectFrom("deckCards as dc")
        .innerJoin("decks as d", "d.id", "dc.deckId")
        .select([
          "dc.id",
          "dc.deckId",
          "dc.cardId",
          "dc.zone",
          "dc.quantity",
          "dc.preferredPrintingId",
        ])
        .where("d.userId", "=", userId)
        .orderBy("dc.id");
      if (sinceXid !== undefined) {
        query = query.where(sql<boolean>`d.updated_xid >= ${sinceXid}::xid8`);
      }
      if (page !== undefined) {
        query = query.limit(page.limit + 1);
        if (page.after !== undefined) {
          query = query.where("dc.id", ">", page.after);
        }
      }
      return query.execute();
    },

    /**
     * Each deck's version (`updated_xid`), every deck or those touched since the watermark.
     * Includes a deck whose cards are now all gone, which contributes no rows of its own.
     */
    deckVersions(userId: string, sinceXid?: string): Promise<{ id: string; version: string }[]> {
      let query = db
        .selectFrom("decks as d")
        .select(["d.id", sql<string>`d.updated_xid::text`.as("version")])
        .where("d.userId", "=", userId);
      if (sinceXid !== undefined) {
        query = query.where(sql<boolean>`d.updated_xid >= ${sinceXid}::xid8`);
      }
      return query.execute();
    },

    allCardsForUser(userId: string): Promise<DeckCardDetailRow[]> {
      return db
        .selectFrom("deckCards as dc")
        .innerJoin("decks as d", "d.id", "dc.deckId")
        .innerJoin("cards as c", "c.id", "dc.cardId")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "c.id")
        .select([
          "dc.id",
          "dc.deckId",
          "dc.cardId",
          "dc.zone",
          "dc.quantity",
          "dc.preferredPrintingId",
          "c.name as cardName",
          primaryCardTypeSql("c.id").as("cardType"),
          "mca.types as cardTypes",
          "mca.domains",
          "mca.superTypes",
          "c.tags",
          "c.keywords",
          "c.energy",
          "c.might",
          "c.power",
          "c.maxCopiesOverride",
          "c.additionalLegendCount",
        ])
        .where("d.userId", "=", userId)
        .orderBy("dc.deckId")
        .orderBy("dc.zone")
        .orderBy("c.name")
        .execute();
    },

    /**
     * With `expectedVersion`, the replace runs only while the deck is still at that version
     * (`updated_xid`); otherwise it answers the stored version and cards.
     */
    replaceCards(
      deckId: string,
      cards: {
        cardId: string;
        zone: DeckZone;
        quantity: number;
        preferredPrintingId: string | null;
      }[],
      expectedVersion?: string,
    ): Promise<ReplaceDeckCardsResult> {
      return inTransaction(db, async (trx) => {
        // A second UPDATE of a deck row this transaction already rewrote re-runs its
        // FK checks and key-share locks the user row, deadlocking with account deletion.
        let touch = trx
          .updateTable("decks")
          .set({ updatedAt: sql`now()` })
          .where("id", "=", deckId);
        if (expectedVersion !== undefined) {
          touch = touch.where(sql<boolean>`updated_xid = ${expectedVersion}::xid8`);
        }
        const deck = await touch
          .returning(sql<string>`updated_xid::text`.as("version"))
          .executeTakeFirst();
        if (!deck) {
          return expectedVersion === undefined
            ? { outcome: "missing" }
            : staleDeckCards(trx, deckId);
        }
        await trx.deleteFrom("deckCards").where("deckId", "=", deckId).execute();

        if (cards.length > 0) {
          await trx
            .insertInto("deckCards")
            .values(cards.map((card) => ({ deckId, ...card })))
            .execute();
        }
        return { outcome: "replaced", version: deck.version };
      });
    },
  };
}
