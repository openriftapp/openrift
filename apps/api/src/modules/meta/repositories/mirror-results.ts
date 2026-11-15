import type { Kysely } from "kysely";

import { primaryCardTypeSql } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import { keyBatches, rowBatches } from "../../../lib/bind-batches.js";
import { inTransaction, withKeyLock } from "../../../repositories/query-helpers.js";

type MirrorStep = (trx: Kysely<Database>) => Promise<unknown>;

interface MirrorReplace {
  clear: MirrorStep;
  insert: MirrorStep;
}

export interface MirrorDeckCoverage {
  outstanding: string[];
  held: number;
}

interface MirrorCardRef {
  cardId: string;
  name: string;
  type: string;
}

export function replaceRows<T extends object>(
  clear: MirrorStep,
  rows: readonly T[],
  insert: (trx: Kysely<Database>, batch: T[]) => Promise<unknown>,
): MirrorReplace {
  return {
    clear,
    insert: async (trx) => {
      for (const batch of rowBatches(rows)) {
        await insert(trx, batch);
      }
    },
  };
}

export async function replaceUnderEventLock(
  db: Kysely<Database>,
  source: string,
  key: string | number,
  ...replaces: MirrorReplace[]
): Promise<void> {
  await withKeyLock(db, `${source}-event:${key}`, async (trx) => {
    for (const replace of replaces) {
      await replace.clear(trx);
    }
    for (const replace of replaces) {
      await replace.insert(trx);
    }
  });
}

export async function putMirrorDecklist(
  db: Kysely<Database>,
  upsertDeck: MirrorStep,
  cards: MirrorReplace,
): Promise<void> {
  await inTransaction(db, async (trx) => {
    await upsertDeck(trx);
    await cards.clear(trx);
    await cards.insert(trx);
  });
}

export function deckCoverageOf(
  referenced: readonly (string | null)[],
  held: ReadonlySet<string>,
): MirrorDeckCoverage {
  return {
    outstanding: referenced.filter((id): id is string => id !== null && !held.has(id)),
    held: held.size,
  };
}

export async function cardsByShortCode(
  db: Kysely<Database>,
  language: string,
  shortCodes: readonly string[],
): Promise<Map<string, MirrorCardRef>> {
  const map = new Map<string, MirrorCardRef>();
  for (const batch of keyBatches([...new Set(shortCodes)])) {
    const rows = await db
      .selectFrom("faces as p")
      .innerJoin("cards as c", "c.id", "p.cardId")
      .where("p.language", "=", language)
      .where("p.shortCode", "in", batch)
      .select([
        "p.shortCode as shortCode",
        "c.id as cardId",
        "c.name as name",
        primaryCardTypeSql("c.id").as("type"),
      ])
      .execute();
    // Multiple printings share a short_code (finishes, variants); they are
    // the same card, so the first wins.
    for (const row of rows) {
      if (!map.has(row.shortCode)) {
        map.set(row.shortCode, { cardId: row.cardId, name: row.name, type: row.type });
      }
    }
  }
  return map;
}
