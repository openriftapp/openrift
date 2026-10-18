import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

/**
 * ADR-020 pair merge: builds double-sided printings from existing single-sided ones and moves
 * everything that pointed at a single-sided printing to its home, then deletes it.
 */
export interface PairMergeList {
  printings: {
    key: string;
    /** Slugs of two single-sided printings; each contributes its side. */
    sides: [string, string];
    size?: string;
  }[];
  /** For a side printing listed on several physical printings: the key of its home. */
  homes?: Record<string, string>;
}

export interface PairMergeSourceReport {
  slug: string;
  home: string;
  moved: Record<string, number>;
}

export interface PairMergeReport {
  created: { key: string; sides: [string, string] }[];
  sources: PairMergeSourceReport[];
}

interface SourceRow {
  id: string;
  slug: string;
  face1Id: string;
  face2Id: string | null;
  size: string;
}

/** Tables whose rows move to the home printing; `merge` rows collide on a unique key there. */
const MOVES: { table: string; column: string; conflict?: string; sum?: string }[] = [
  { table: "copies", column: "printing_id" },
  { table: "collection_events", column: "printing_id" },
  { table: "card_trades", column: "printing_id" },
  { table: "loans", column: "printing_id" },
  { table: "printing_events", column: "printing_id" },
  { table: "candidate_printings", column: "printing_id" },
  { table: "meta_event_player_overlay_cards", column: "preferred_printing_id" },
  { table: "list_entries", column: "printing_id", conflict: "list_id", sum: "quantity" },
  {
    table: "deck_cards",
    column: "preferred_printing_id",
    conflict: "deck_id, card_id, zone",
    sum: "quantity",
  },
  { table: "product_printings", column: "printing_id", conflict: "product_id", sum: "quantity" },
  {
    table: "marketplace_product_variants",
    column: "printing_id",
    conflict: "marketplace_product_id",
  },
  {
    table: "trade_suggestion_dismissals",
    column: "printing_id",
    conflict: "user_id, counterparty_user_id, direction",
  },
  { table: "printing_distribution_channels", column: "printing_id", conflict: "channel_id" },
  { table: "printing_citations", column: "printing_id", conflict: "source_url" },
  {
    table: "cardmarket_sync_state",
    column: "printing_id",
    conflict: "user_id, condition, is_altered",
  },
];

export class PairMergeError extends Error {
  override name = "PairMergeError";
}

async function loadSources(
  db: Kysely<Database>,
  list: PairMergeList,
): Promise<Map<string, SourceRow>> {
  const slugs = [...new Set(list.printings.flatMap((entry) => entry.sides))];
  const rows = await db
    .selectFrom("printings")
    .select(["id", "slug", "face1Id", "face2Id", "size"])
    .where("slug", "in", slugs)
    .execute();
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    throw new PairMergeError(`Unknown printing slug(s): ${missing.join(", ")}`);
  }
  const doubled = rows.filter((row) => row.face2Id !== null).map((row) => row.slug);
  if (doubled.length > 0) {
    throw new PairMergeError(`Already double-sided: ${doubled.join(", ")}`);
  }
  return bySlug;
}

function resolveHomes(list: PairMergeList): Map<string, string> {
  const keys = new Set(list.printings.map((entry) => entry.key));
  if (keys.size !== list.printings.length) {
    throw new PairMergeError("Printing keys must be unique");
  }
  const entriesBySlug = new Map<string, string[]>();
  for (const entry of list.printings) {
    if (entry.sides[0] === entry.sides[1]) {
      throw new PairMergeError(`${entry.key}: the two sides must be different printings`);
    }
    for (const slug of entry.sides) {
      entriesBySlug.set(slug, [...(entriesBySlug.get(slug) ?? []), entry.key]);
    }
  }
  const homes = new Map<string, string>();
  for (const [slug, entryKeys] of entriesBySlug) {
    const chosen = list.homes?.[slug];
    if (chosen !== undefined) {
      if (!entryKeys.includes(chosen)) {
        throw new PairMergeError(`${slug}: home ${chosen} does not show this side`);
      }
      homes.set(slug, chosen);
    } else if (entryKeys.length === 1) {
      homes.set(slug, entryKeys[0] ?? "");
    } else {
      throw new PairMergeError(`${slug} is on ${entryKeys.join(", ")}; name its home`);
    }
  }
  return homes;
}

async function countMoves(db: Kysely<Database>, sourceId: string): Promise<Record<string, number>> {
  const moved: Record<string, number> = {};
  for (const { table, column } of MOVES) {
    const { rows } = await sql<{ count: number }>`
      SELECT count(*)::int AS count FROM ${sql.table(table)} WHERE ${sql.ref(column)} = ${sourceId}
    `.execute(db);
    const count = rows[0]?.count ?? 0;
    if (count > 0) {
      moved[table] = count;
    }
  }
  return moved;
}

async function moveReferences(
  db: Kysely<Database>,
  sourceId: string,
  homeId: string,
): Promise<void> {
  for (const { table, column, conflict, sum } of MOVES) {
    const target = sql.table(table);
    const ref = sql.ref(column);
    if (conflict !== undefined) {
      const keys = conflict.split(",").map((key) => key.trim());
      const matches = sql.join(
        keys.map((key) => sql`h.${sql.ref(key)} = s.${sql.ref(key)}`),
        sql` AND `,
      );
      if (sum !== undefined) {
        await sql`
          UPDATE ${target} h SET ${sql.ref(sum)} = h.${sql.ref(sum)} + s.${sql.ref(sum)}
          FROM ${target} s
          WHERE h.${ref} = ${homeId} AND s.${ref} = ${sourceId} AND ${matches}
        `.execute(db);
      }
      await sql`
        DELETE FROM ${target} s
        WHERE s.${ref} = ${sourceId}
          AND EXISTS (SELECT 1 FROM ${target} h WHERE h.${ref} = ${homeId} AND ${matches})
      `.execute(db);
    }
    await sql`UPDATE ${target} SET ${ref} = ${homeId} WHERE ${ref} = ${sourceId}`.execute(db);
  }
}

export async function planPairMerge(
  db: Kysely<Database>,
  list: PairMergeList,
): Promise<PairMergeReport> {
  const sources = await loadSources(db, list);
  const homes = resolveHomes(list);
  const report: PairMergeReport = {
    created: list.printings.map((entry) => ({ key: entry.key, sides: entry.sides })),
    sources: [],
  };
  for (const [slug, home] of homes) {
    const source = sources.get(slug);
    if (source) {
      report.sources.push({ slug, home, moved: await countMoves(db, source.id) });
    }
  }
  return report;
}

/** Runs the whole merge in one transaction; any failure leaves the catalog untouched. */
export async function applyPairMerge(
  db: Kysely<Database>,
  list: PairMergeList,
): Promise<PairMergeReport> {
  return await db.transaction().execute(async (trx) => {
    const report = await planPairMerge(trx, list);
    const sources = await loadSources(trx, list);
    const homes = resolveHomes(list);
    const homeIdByKey = new Map<string, string>();
    for (const entry of list.printings) {
      const [first, second] = entry.sides.map((slug) => sources.get(slug)) as [
        SourceRow,
        SourceRow,
      ];
      const physical = await trx
        .selectFrom("printings")
        .select(["releasedAt", "releasePrecision", "announcedAt", "comment"])
        .where("id", "=", first.id)
        .executeTakeFirstOrThrow();
      const created = await trx
        .insertInto("printings")
        .values({
          face1Id: first.face1Id,
          face2Id: second.face1Id,
          size: entry.size ?? first.size,
          ...physical,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      homeIdByKey.set(entry.key, created.id);
    }
    for (const [slug, homeKey] of homes) {
      const source = sources.get(slug);
      const homeId = homeIdByKey.get(homeKey);
      if (source && homeId) {
        await moveReferences(trx, source.id, homeId);
        await trx.deleteFrom("printings").where("id", "=", source.id).execute();
      }
    }
    return report;
  });
}
