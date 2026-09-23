import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { CardsTable } from "../../../db/tables/catalog.js";
import type { DeckCardsTable } from "../../../db/tables/decks.js";
import { safeXidExpression } from "../../../repositories/query-helpers.js";

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
    imageUrl: string | null;
  };

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
          "c.type as cardType",
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
          sql<string | null>`(
            SELECT COALESCE(ci.rehosted_url, ci.original_url)
            FROM printings p
            JOIN sets s ON s.id = p.set_id
            JOIN printing_images pi ON pi.printing_id = p.id
              AND pi.face = 'front' AND pi.is_active = true
            JOIN image_files ci ON ci.id = pi.image_file_id
            WHERE p.card_id = dc.card_id
            ORDER BY
              (p.art_variant = ${WellKnown.artVariant.NORMAL})::int DESC,
              (cardinality(p.marker_slugs) = 0)::int DESC,
              (p.is_signed = false)::int DESC,
              (p.finish = ${WellKnown.finish.NORMAL})::int DESC,
              s.sort_order ASC,
              p.short_code ASC
            LIMIT 1
          )`.as("imageUrl"),
        ])
        .where("dc.deckId", "=", deckId)
        .where("d.userId", "=", userId)
        .orderBy("dc.zone")
        .orderBy("c.name")
        .execute();
    },

    async currentSafeXid(): Promise<string> {
      const row = await db.selectNoFrom(safeXidExpression.as("xid")).executeTakeFirstOrThrow();
      return row.xid;
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
        zone: string;
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

    /** Includes a deck whose cards are now all gone, which contributes no rows of its own. */
    async deckIdsTouchedSince(userId: string, sinceXid: string): Promise<string[]> {
      const rows = await db
        .selectFrom("decks as d")
        .select("d.id")
        .where("d.userId", "=", userId)
        .where(sql<boolean>`d.updated_xid >= ${sinceXid}::xid8`)
        .execute();
      return rows.map((row) => row.id);
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
          "c.type as cardType",
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
          sql<string | null>`null`.as("imageUrl"),
        ])
        .where("d.userId", "=", userId)
        .orderBy("dc.deckId")
        .orderBy("dc.zone")
        .orderBy("c.name")
        .execute();
    },

    async replaceCards(
      deckId: string,
      cards: {
        cardId: string;
        zone: DeckZone;
        quantity: number;
        preferredPrintingId: string | null;
      }[],
    ): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("deckCards").where("deckId", "=", deckId).execute();

        if (cards.length > 0) {
          await trx
            .insertInto("deckCards")
            .values(cards.map((card) => ({ deckId, ...card })))
            .execute();
        }

        await trx
          .updateTable("decks")
          .set({ updatedAt: sql`now()` })
          .where("id", "=", deckId)
          .execute();
      });
    },
  };
}
