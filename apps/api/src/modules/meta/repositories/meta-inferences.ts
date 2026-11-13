import type { MetaListStatus } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MetaInferredZone } from "../../../db/tables/meta.js";
import { META_INFERRED_ZONES } from "../../../db/tables/meta.js";
import { inTransaction } from "../../../repositories/query-helpers.js";
import { resolvedPlayerName } from "./meta-shared.js";

const WRITE_CHUNK = 500;

export interface ChampionFactRow {
  id: string;
  tags: string[];
  keywords: string[];
  maxCopiesOverride: number | null;
  isChampion: boolean;
}

export interface InferenceGroupRow {
  legendCardId: string;
  format: string;
}

export interface InferenceCardRow {
  deckId: string;
  listStatus: MetaListStatus;
  cardId: string;
  zone: string;
  quantity: number;
}

export interface StoredInference {
  deckId: string;
  championCardId: string | null;
  championAltCardId: string | null;
  championUnsure: boolean;
  battlefieldCardId: string | null;
  battlefieldAlsoCardIds: string[];
  neighbours: { zone: MetaInferredZone; neighbourDeckId: string; shared: number }[];
}

export interface InferenceNeighbourRow {
  zone: MetaInferredZone;
  shared: number;
  shareToken: string;
  playerName: string;
  eventName: string;
  rank: number;
  rankIsTier: boolean;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  championCardId: string | null;
  championName: string | null;
  battlefieldNames: string[];
}

export interface DeckInferenceRow {
  championCardId: string | null;
  championAltCardId: string | null;
  championUnsure: boolean;
  battlefieldCardId: string | null;
  battlefieldAlsoCardIds: string[];
  neighbours: InferenceNeighbourRow[];
}

export interface ListShapeRow {
  deckId: string;
  format: string;
  legend: number;
  champion: number;
  battlefield: number;
  main: number;
  runes: number;
  battlefieldCardIds: string[];
  guessedChampionCardId: string | null;
  guessedChampionName: string | null;
  guessedChampionAltName: string | null;
  guessedBattlefieldCardId: string | null;
}

export function metaInferencesRepo(db: Kysely<Database>) {
  return {
    championFacts(): Promise<ChampionFactRow[]> {
      return db
        .selectFrom("cards as c")
        .select([
          "c.id",
          "c.tags",
          "c.keywords",
          "c.maxCopiesOverride",
          sql<boolean>`exists (
            select 1 from card_super_types st
            where st.card_id = c.id and st.super_type_slug = ${WellKnown.superType.CHAMPION}
          ) and exists (
            select 1 from card_card_types ct
            where ct.card_id = c.id and ct.type_slug = ${WellKnown.cardType.UNIT}
          )`.as("isChampion"),
        ])
        .execute();
    },

    inferenceGroups(): Promise<InferenceGroupRow[]> {
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("decks as d", "d.id", "p.deckId")
        .select(["p.legendCardId", "d.format"])
        .distinct()
        .where("p.listStatus", "=", "partial")
        .where("p.legendCardId", "is not", null)
        .where("d.shareToken", "is not", null)
        .$narrowType<{ legendCardId: string }>()
        .execute();
    },

    inferenceDecks(legendCardId: string, format: string): Promise<InferenceCardRow[]> {
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("decks as d", "d.id", "p.deckId")
        .innerJoin("deckCards as dc", "dc.deckId", "d.id")
        .select(["d.id as deckId", "p.listStatus", "dc.cardId", "dc.zone", "dc.quantity"])
        .where("p.legendCardId", "=", legendCardId)
        .where("d.format", "=", format)
        .where("d.shareToken", "is not", null)
        .where("dc.zone", "in", [
          WellKnown.deckZone.MAIN,
          WellKnown.deckZone.CHAMPION,
          WellKnown.deckZone.BATTLEFIELD,
        ])
        .execute();
    },

    async storedInferences(): Promise<StoredInference[]> {
      const [rows, neighbours] = await Promise.all([
        db
          .selectFrom("metaDeckInferences")
          .select([
            "deckId",
            "championCardId",
            "championAltCardId",
            "championUnsure",
            "battlefieldCardId",
            "battlefieldAlsoCardIds",
          ])
          .execute(),
        db
          .selectFrom("metaDeckInferenceNeighbours")
          .select(["deckId", "zone", "neighbourDeckId", "shared"])
          .orderBy("deckId")
          .orderBy("zone")
          .orderBy("position")
          .execute(),
      ]);
      const byDeck = Map.groupBy(neighbours, (row) => row.deckId);
      return rows.map((row) => ({
        ...row,
        neighbours: (byDeck.get(row.deckId) ?? []).map(({ zone, neighbourDeckId, shared }) => ({
          zone,
          neighbourDeckId,
          shared,
        })),
      }));
    },

    async replaceInferences(
      written: readonly StoredInference[],
      removed: readonly string[],
    ): Promise<void> {
      await inTransaction(db, async (trx) => {
        const cleared = [...removed, ...written.map((row) => row.deckId)];
        for (let start = 0; start < cleared.length; start += WRITE_CHUNK) {
          await trx
            .deleteFrom("metaDeckInferences")
            .where("deckId", "in", cleared.slice(start, start + WRITE_CHUNK))
            .execute();
        }
        for (let start = 0; start < written.length; start += WRITE_CHUNK) {
          const chunk = written.slice(start, start + WRITE_CHUNK);
          await trx
            .insertInto("metaDeckInferences")
            .values(
              chunk.map((row) => ({
                deckId: row.deckId,
                championCardId: row.championCardId,
                championAltCardId: row.championAltCardId,
                championUnsure: row.championUnsure,
                battlefieldCardId: row.battlefieldCardId,
                battlefieldAlsoCardIds: row.battlefieldAlsoCardIds,
              })),
            )
            .execute();
          const neighbours = chunk.flatMap((row) =>
            META_INFERRED_ZONES.flatMap((zone) =>
              row.neighbours
                .filter((neighbour) => neighbour.zone === zone)
                .map((neighbour, position) => ({
                  deckId: row.deckId,
                  zone: neighbour.zone,
                  position,
                  neighbourDeckId: neighbour.neighbourDeckId,
                  shared: neighbour.shared,
                })),
            ),
          );
          if (neighbours.length > 0) {
            await trx.insertInto("metaDeckInferenceNeighbours").values(neighbours).execute();
          }
        }
      });
    },

    async inferenceForDeck(deckId: string): Promise<DeckInferenceRow | undefined> {
      const row = await db
        .selectFrom("metaDeckInferences")
        .select([
          "championCardId",
          "championAltCardId",
          "championUnsure",
          "battlefieldCardId",
          "battlefieldAlsoCardIds",
        ])
        .where("deckId", "=", deckId)
        .executeTakeFirst();
      if (row === undefined) {
        return undefined;
      }
      const neighbours = await db
        .selectFrom("metaDeckInferenceNeighbours as n")
        .innerJoin("decks as d", "d.id", "n.neighbourDeckId")
        .innerJoin("metaEventPlayers as p", "p.deckId", "d.id")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .leftJoin("uvsgamesPlayers as up", "up.id", "p.uvsgamesPlayerId")
        .select((eb) => [
          "n.zone",
          "n.shared",
          "d.shareToken",
          resolvedPlayerName.as("playerName"),
          "me.name as eventName",
          "p.rank",
          "p.rankIsTier",
          "p.wins",
          "p.losses",
          "p.draws",
          eb
            .selectFrom("deckCards as dc")
            .select("dc.cardId")
            .whereRef("dc.deckId", "=", "d.id")
            .where("dc.zone", "=", WellKnown.deckZone.CHAMPION)
            .limit(1)
            .as("championCardId"),
          eb
            .selectFrom("deckCards as dc")
            .innerJoin("cards as c", "c.id", "dc.cardId")
            .select("c.name")
            .whereRef("dc.deckId", "=", "d.id")
            .where("dc.zone", "=", WellKnown.deckZone.CHAMPION)
            .limit(1)
            .as("championName"),
          sql<string[]>`coalesce((
            select array_agg(bc.name order by bc.name)
            from deck_cards bdc join cards bc on bc.id = bdc.card_id
            where bdc.deck_id = d.id and bdc.zone = ${WellKnown.deckZone.BATTLEFIELD}
          ), '{}')`.as("battlefieldNames"),
        ])
        .where("n.deckId", "=", deckId)
        .where("d.shareToken", "is not", null)
        .orderBy("n.zone")
        .orderBy("n.position")
        .$narrowType<{ shareToken: string }>()
        .execute();
      return { ...row, neighbours };
    },

    listShapes(deckIds: readonly string[]): Promise<ListShapeRow[]> {
      if (deckIds.length === 0) {
        return Promise.resolve([]);
      }
      const count = (zone: string) =>
        sql<number>`coalesce(sum(dc.quantity) filter (where dc.zone = ${zone}), 0)::int`;
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("decks as d", "d.id", "p.deckId")
        .leftJoin("deckCards as dc", "dc.deckId", "d.id")
        .leftJoin("metaDeckInferences as i", "i.deckId", "d.id")
        .leftJoin("cards as gc", "gc.id", "i.championCardId")
        .leftJoin("cards as gac", "gac.id", "i.championAltCardId")
        .select([
          "d.id as deckId",
          "d.format",
          count(WellKnown.deckZone.LEGEND).as("legend"),
          count(WellKnown.deckZone.CHAMPION).as("champion"),
          count(WellKnown.deckZone.BATTLEFIELD).as("battlefield"),
          count(WellKnown.deckZone.MAIN).as("main"),
          count(WellKnown.deckZone.RUNES).as("runes"),
          sql<
            string[]
          >`coalesce(array_agg(dc.card_id) filter (where dc.zone = ${WellKnown.deckZone.BATTLEFIELD}), '{}')`.as(
            "battlefieldCardIds",
          ),
          sql<string | null>`max(i.champion_card_id::text)`.as("guessedChampionCardId"),
          sql<string | null>`max(gc.name)`.as("guessedChampionName"),
          sql<string | null>`max(gac.name)`.as("guessedChampionAltName"),
          sql<string | null>`max(i.battlefield_card_id::text)`.as("guessedBattlefieldCardId"),
        ])
        .where("d.id", "in", deckIds)
        .where("p.listStatus", "=", "partial")
        .groupBy(["d.id", "d.format"])
        .execute();
    },
  };
}
