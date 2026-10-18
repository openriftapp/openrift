import type { Insertable, Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { FacesTable } from "../../../db/tables/catalog.js";

/**
 * ADR-020 pair merge: builds double-sided printings and moves everything that pointed at a
 * single-sided side printing to its home, then deletes it.
 */

/**
 * A side is the slug of a single-sided printing (which moves into the new printing), an
 * existing face found by a printing that shows it and its short code, or a face the list creates.
 */
export type PairMergeSide = string | { faceOf: string; code: string } | { newFace: string };

/** A new face copies an existing one and overrides the printed fields that differ. */
export interface PairMergeNewFace {
  copyOf: { faceOf: string; code: string };
  setSlug?: string;
  shortCode?: string;
  publicCode?: string;
  language?: string;
  finish?: string;
  markerSlugs?: string[];
  artist?: string;
}

export interface PairMergeList {
  printings: { key: string; sides: [PairMergeSide, PairMergeSide]; size?: string }[];
  newFaces?: Record<string, PairMergeNewFace>;
  homes?: Record<string, string>;
}

export interface PairMergeSourceReport {
  slug: string;
  home: string;
  defaultHome: boolean;
  moved: Record<string, number>;
}

export interface PairMergeOwnerReport {
  slug: string;
  home: string;
  userId: string | null;
  groupId: string | null;
  email: string | null;
  copies: number;
}

export interface PairMergeReport {
  created: { key: string }[];
  newFaces: string[];
  sources: PairMergeSourceReport[];
  owners: PairMergeOwnerReport[];
}

interface SourceRow {
  id: string;
  slug: string;
  face1Id: string;
  face2Id: string | null;
  size: string;
}

/** Tables whose rows move to the home printing; rows that collide on `conflict` merge. */
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

function sideLabel(side: PairMergeSide): string {
  if (typeof side === "string") {
    return side;
  }
  return "newFace" in side ? `new:${side.newFace}` : `${side.faceOf}:${side.code}`;
}

async function loadSources(
  db: Kysely<Database>,
  list: PairMergeList,
): Promise<Map<string, SourceRow>> {
  const slugs = [
    ...new Set(
      list.printings.flatMap((entry) => entry.sides.filter((side) => typeof side === "string")),
    ),
  ];
  if (slugs.length === 0) {
    return new Map();
  }
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

async function findFace(
  db: Kysely<Database>,
  ref: { faceOf: string; code: string },
): Promise<string> {
  const row = await db
    .selectFrom("printings as p")
    .innerJoin("faces as f", (join) =>
      join.on((eb) =>
        eb.or([eb("f.id", "=", eb.ref("p.face1Id")), eb("f.id", "=", eb.ref("p.face2Id"))]),
      ),
    )
    .select("f.id")
    .where("p.slug", "=", ref.faceOf)
    .where("f.shortCode", "=", ref.code)
    .executeTakeFirst();
  if (!row) {
    throw new PairMergeError(`No ${ref.code} side on ${ref.faceOf}`);
  }
  return row.id;
}

function resolveHomes(list: PairMergeList): Map<string, { key: string; defaulted: boolean }> {
  const keys = new Set(list.printings.map((entry) => entry.key));
  if (keys.size !== list.printings.length) {
    throw new PairMergeError("Printing keys must be unique");
  }
  const entriesBySlug = new Map<string, string[]>();
  for (const entry of list.printings) {
    if (sideLabel(entry.sides[0]) === sideLabel(entry.sides[1])) {
      throw new PairMergeError(`${entry.key}: the two sides must be different`);
    }
    for (const side of entry.sides) {
      if (typeof side === "string") {
        entriesBySlug.set(side, [...(entriesBySlug.get(side) ?? []), entry.key]);
      }
    }
  }
  const homes = new Map<string, { key: string; defaulted: boolean }>();
  for (const [slug, entryKeys] of entriesBySlug) {
    const chosen = list.homes?.[slug];
    if (chosen !== undefined && !entryKeys.includes(chosen)) {
      throw new PairMergeError(`${slug}: home ${chosen} does not show this side`);
    }
    homes.set(slug, {
      key: chosen ?? entryKeys[0] ?? "",
      defaulted: chosen === undefined && entryKeys.length > 1,
    });
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

async function ownersOf(
  db: Kysely<Database>,
  sourceId: string,
): Promise<Omit<PairMergeOwnerReport, "slug" | "home">[]> {
  const { rows } = await sql<Omit<PairMergeOwnerReport, "slug" | "home">>`
    SELECT col.user_id AS "userId", col.group_id AS "groupId", u.email, count(*)::int AS copies
    FROM copies cp
    JOIN collections col ON col.id = cp.collection_id
    LEFT JOIN users u ON u.id = col.user_id
    WHERE cp.printing_id = ${sourceId}
    GROUP BY col.user_id, col.group_id, u.email
    ORDER BY u.email NULLS LAST
  `.execute(db);
  return rows;
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

async function checkFaceRefs(db: Kysely<Database>, list: PairMergeList): Promise<void> {
  for (const entry of list.printings) {
    for (const side of entry.sides) {
      if (typeof side !== "string") {
        if ("newFace" in side) {
          if (list.newFaces?.[side.newFace] === undefined) {
            throw new PairMergeError(`${entry.key}: unknown new face ${side.newFace}`);
          }
        } else {
          await findFace(db, side);
        }
      }
    }
  }
  for (const spec of Object.values(list.newFaces ?? {})) {
    await findFace(db, spec.copyOf);
  }
}

export async function planPairMerge(
  db: Kysely<Database>,
  list: PairMergeList,
): Promise<PairMergeReport> {
  const sources = await loadSources(db, list);
  const homes = resolveHomes(list);
  await checkFaceRefs(db, list);
  const report: PairMergeReport = {
    created: list.printings.map((entry) => ({ key: entry.key })),
    newFaces: Object.keys(list.newFaces ?? {}),
    sources: [],
    owners: [],
  };
  for (const [slug, home] of homes) {
    const source = sources.get(slug);
    if (!source) {
      continue;
    }
    report.sources.push({
      slug,
      home: home.key,
      defaultHome: home.defaulted,
      moved: await countMoves(db, source.id),
    });
    if (home.defaulted) {
      for (const owner of await ownersOf(db, source.id)) {
        report.owners.push({ slug, home: home.key, ...owner });
      }
    }
  }
  return report;
}

async function createFace(db: Kysely<Database>, spec: PairMergeNewFace): Promise<string> {
  const sourceId = await findFace(db, spec.copyOf);
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...source
  } = await db.selectFrom("faces").selectAll().where("id", "=", sourceId).executeTakeFirstOrThrow();
  let setId = source.setId;
  if (spec.setSlug !== undefined) {
    const set = await db
      .selectFrom("sets")
      .select("id")
      .where("slug", "=", spec.setSlug)
      .executeTakeFirst();
    if (!set) {
      throw new PairMergeError(`Unknown set ${spec.setSlug}`);
    }
    setId = set.id;
  }
  const values: Insertable<FacesTable> = {
    ...source,
    setId,
    shortCode: spec.shortCode ?? source.shortCode,
    publicCode: spec.publicCode ?? source.publicCode,
    language: spec.language ?? source.language,
    finish: spec.finish ?? source.finish,
    markerSlugs: spec.markerSlugs ?? source.markerSlugs,
    artist: spec.artist ?? source.artist,
  } as Insertable<FacesTable>;
  const created = await db
    .insertInto("faces")
    .values(values)
    .returning("id")
    .executeTakeFirstOrThrow();
  return created.id;
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
    const newFaceIds = new Map<string, string>();
    for (const [name, spec] of Object.entries(list.newFaces ?? {})) {
      newFaceIds.set(name, await createFace(trx, spec));
    }
    const faceIdOf = (side: PairMergeSide): Promise<string> | string => {
      if (typeof side === "string") {
        return (sources.get(side) as SourceRow).face1Id;
      }
      return "newFace" in side ? (newFaceIds.get(side.newFace) as string) : findFace(trx, side);
    };
    const homeIdByKey = new Map<string, string>();
    for (const entry of list.printings) {
      const sourceSide = entry.sides.find((side) => typeof side === "string");
      const source = sourceSide === undefined ? undefined : sources.get(sourceSide);
      const physical = source
        ? await trx
            .selectFrom("printings")
            .select(["releasedAt", "releasePrecision", "announcedAt", "comment"])
            .where("id", "=", source.id)
            .executeTakeFirstOrThrow()
        : {};
      const created = await trx
        .insertInto("printings")
        .values({
          face1Id: await faceIdOf(entry.sides[0]),
          face2Id: await faceIdOf(entry.sides[1]),
          size: entry.size ?? source?.size ?? "standard",
          ...physical,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      homeIdByKey.set(entry.key, created.id);
    }
    for (const [slug, home] of homes) {
      const source = sources.get(slug);
      const homeId = homeIdByKey.get(home.key);
      if (source && homeId) {
        await moveReferences(trx, source.id, homeId);
        await trx.deleteFrom("printings").where("id", "=", source.id).execute();
      }
    }
    return report;
  });
}
