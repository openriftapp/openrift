import { legendDisplayName } from "@openrift/shared/card-name";
import type { CardType, Finish, Rarity } from "@openrift/shared/types/enums";
import type {
  Expression,
  ExpressionBuilder,
  Kysely,
  RawBuilder,
  Selectable,
  SelectQueryBuilder,
  SqlBool,
  StringReference,
} from "kysely";
import { sql } from "kysely";

import type { Database } from "../db/tables.js";
import type {
  FaceImagesTable,
  FacesTable,
  ImageFilesTable,
  PrintingsTable,
} from "../db/tables/catalog.js";
import type { CopiesTable } from "../db/tables/collections.js";
import { parseKeysetCursor } from "../lib/keyset-cursor.js";

/**
 * Resolves the image_files.id for a self-hosted image. NULL when the row
 * hasn't been rehosted yet, so callers can filter `IS NOT NULL` to exclude
 * external-only entries from public pages. The client constructs variant URLs
 * from this ID via `imageUrl()` in shared.
 */
export function imageId(alias: string): RawBuilder<string | null> {
  return sql<
    string | null
  >`CASE WHEN ${sql.ref(`${alias}.rehostedUrl`)} IS NOT NULL THEN ${sql.ref(`${alias}.id`)} ELSE NULL END`;
}

export function fallbackImageId(alias: string) {
  return sql<string | null>`(
    SELECT fbf.id FROM image_files fbf
    WHERE fbf.id = ${sql.ref(`${alias}.fallbackImageFileId`)}
      AND fbf.rehosted_url IS NOT NULL
  )`.as("fallbackImageId");
}

/**
 * Falls back to the original provider URL. Use this only in admin contexts
 * where showing external images is acceptable.
 */
export function imageUrlWithOriginal(alias: string): RawBuilder<string | null> {
  return sql<
    string | null
  >`COALESCE(${sql.ref(`${alias}.rehostedUrl`)}, ${sql.ref(`${alias}.originalUrl`)})`;
}

interface OwnedKeysetRow {
  userId: string;
  createdAt: Date;
  id: string;
}

type OwnedKeysetTable = {
  [K in keyof Database]: Database[K] extends {
    userId: unknown;
    createdAt: unknown;
    id: unknown;
  }
    ? K
    : never;
}[keyof Database];

/**
 * One user's rows from an owner-scoped ledger, newest first and keyset
 * paginated on `(created_at desc, id desc)`. Returns up to `limit + 1` rows so
 * the caller can detect a next page.
 *
 * The internal casts are what let one helper serve every such table: the table
 * name is a runtime value, so the column references cannot be resolved against
 * a specific table at compile time. `OwnedKeysetTable` still keeps the argument
 * from naming a table that lacks the columns.
 */
export async function listOwnedByUser<TRow>(
  db: Kysely<Database>,
  table: OwnedKeysetTable,
  userId: string,
  options: { cursor?: string | null; limit: number },
): Promise<TRow[]> {
  let query = (db as unknown as Kysely<{ owned: OwnedKeysetRow }>)
    .selectFrom(table as "owned")
    .selectAll()
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(options.limit + 1);
  if (options.cursor) {
    query = query.where(
      keysetCursorPredicate(options.cursor, {
        timeColumn: "createdAt",
        idColumn: "id",
        idDirection: "desc",
      }),
    );
  }
  const rows = await query.execute();
  return rows as TRow[];
}

/** A row stamped at or below this transaction id is committed or gone. */
const safeXidExpression = sql<string>`pg_snapshot_xmin(pg_current_snapshot())::text`;

export async function currentSafeXid(db: Kysely<Database>): Promise<string> {
  const row = await db.selectNoFrom(safeXidExpression.as("xid")).executeTakeFirstOrThrow();
  return row.xid;
}

/** Reuses an enclosing transaction, since Kysely rejects a nested one. */
export function inTransaction<T>(
  db: Kysely<Database>,
  run: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.isTransaction ? run(db) : db.transaction().execute(run);
}

/**
 * Runs `base` once as the page and once as a `count(*)` with its select list and
 * ORDER BY dropped, so both share the same filters. `base` must not group.
 */
export async function offsetPage<DB, TB extends keyof DB, O>(
  base: SelectQueryBuilder<DB, TB, O>,
  page: { limit: number; offset: number },
): Promise<{ rows: O[]; total: number }> {
  const [rows, countRow] = await Promise.all([
    base.limit(page.limit).offset(page.offset).execute(),
    base
      .clearSelect()
      .clearOrderBy()
      .select(sql<string>`count(*)`.as("total"))
      .executeTakeFirstOrThrow(),
  ]);
  return { rows, total: Number((countRow as { total: string }).total) };
}

/**
 * Callers must validate `keys` against the table's current rows first: an
 * unmatched key is silently ignored, and a row missing from `keys` keeps its old position.
 */
export async function reorderBySortOrder(
  db: Kysely<Database>,
  options: {
    table: keyof Database;
    keyColumn: string;
    keys: readonly string[];
    keyType?: "text" | "uuid";
    scope?: Expression<SqlBool>;
  },
): Promise<void> {
  const { table, keyColumn, keys, keyType = "text", scope } = options;
  if (keys.length === 0) {
    return;
  }

  const cast = sql.raw(keyType);
  const values = sql.join(keys.map((key, i) => sql`(${key}::${cast}, ${i}::int)`));
  const scoped = scope === undefined ? sql`` : sql` and ${scope}`;
  await sql`
    update ${sql.table(table)}
    set sort_order = d.new_order
    from (values ${values}) as d(key, new_order)
    where ${sql.ref(`${table}.${keyColumn}`)} = d.key${scoped}
  `.execute(db);
}

/**
 * Caller's ORDER BY must be `<timeColumn> desc, <idColumn> <idDirection>`.
 * Needs both a `date_trunc('milliseconds', ...)` comparison (the column keeps µs precision a JS `Date` cannot) and a redundant bare-column bound (`date_trunc` is only STABLE, so it alone is not sargable).
 */
export function keysetCursorPredicate(
  cursor: string,
  options: { timeColumn: string; idColumn: string; idDirection: "asc" | "desc" },
): Expression<SqlBool> {
  const { time, id } = parseKeysetCursor(cursor);
  const timeRef = sql.ref(options.timeColumn);
  const truncatedTime = sql<Date>`date_trunc('milliseconds', ${timeRef})`;
  const upperBound = new Date(time.getTime() + 1);
  const sargableBound = sql<SqlBool>`${timeRef} < ${upperBound}`;
  if (id === null) {
    return sql<SqlBool>`(${sargableBound} and ${truncatedTime} < ${time})`;
  }
  const idRef = sql.ref(options.idColumn);
  const tieBreak =
    options.idDirection === "asc" ? sql<SqlBool>`${idRef} > ${id}` : sql<SqlBool>`${idRef} < ${id}`;
  return sql<SqlBool>`(${sargableBound} and (${truncatedTime} < ${time} or (${truncatedTime} = ${time} and ${tieBreak})))`;
}

/** Joins only the first face, as `faceAlias` (default `pf`) on `printingAlias` (default `p`). */
export function withFace1<
  DB extends Record<PrintingAlias, { face1Id: unknown }>,
  TB extends keyof DB,
  O,
  PrintingAlias extends string = "p",
  FaceAlias extends string = "pf",
>(
  qb: SelectQueryBuilder<DB, TB, O>,
  printingAlias?: PrintingAlias,
  faceAlias?: FaceAlias,
): SelectQueryBuilder<DB & Record<FaceAlias, FacesTable>, TB | FaceAlias, O> {
  const face1Id = `${printingAlias ?? "p"}.face1Id` as "p.face1Id";
  const alias = (faceAlias ?? "pf") as "pf";
  return (qb as unknown as SelectQueryBuilder<Database & { p: PrintingsTable }, "p", O>).innerJoin(
    `faces as ${alias}`,
    `${alias}.id`,
    face1Id,
  ) as unknown as SelectQueryBuilder<DB & Record<FaceAlias, FacesTable>, TB | FaceAlias, O>;
}

interface FaceImageTables {
  pi: FaceImagesTable;
  imgf: ImageFilesTable;
}

/** Left-joins the face's active image as `pi` and `imgf`; the query must not already use those aliases. */
export function joinFaceImage<DB extends Database, TB extends keyof DB, O>(
  qb: SelectQueryBuilder<DB, TB, O>,
  faceIdRef: StringReference<DB, TB>,
): SelectQueryBuilder<DB & FaceImageTables, TB | "pi" | "imgf", O> {
  return (qb as unknown as SelectQueryBuilder<Database & { src: { faceId: string } }, "src", O>)
    .leftJoin("faceImages as pi", (join) =>
      join.onRef("pi.faceId", "=", faceIdRef as never).on("pi.isActive", "=", true),
    )
    .leftJoin("imageFiles as imgf", "imgf.id", "pi.imageFileId") as unknown as SelectQueryBuilder<
    DB & FaceImageTables,
    TB | "pi" | "imgf",
    O
  >;
}

interface RequiredFaceImageTables {
  pim: FaceImagesTable;
  imgf: ImageFilesTable;
}

/** Inner variant of {@link joinFaceImage}, exposing `pim` and `imgf`; never combine the two. */
export function requireFaceImage<DB extends Database, TB extends keyof DB, O>(
  qb: SelectQueryBuilder<DB, TB, O>,
  faceIdRef: StringReference<DB, TB>,
): SelectQueryBuilder<DB & RequiredFaceImageTables, TB | "pim" | "imgf", O> {
  return (qb as unknown as SelectQueryBuilder<Database & { src: { faceId: string } }, "src", O>)
    .innerJoin("faceImages as pim", (join) =>
      join.onRef("pim.faceId", "=", faceIdRef as never).on("pim.isActive", "=", true),
    )
    .innerJoin("imageFiles as imgf", "imgf.id", "pim.imageFileId") as unknown as SelectQueryBuilder<
    DB & RequiredFaceImageTables,
    TB | "pim" | "imgf",
    O
  >;
}

/**
 * Requires a **left**-joined `mvCardAggregates as mca`: it is refreshed on demand,
 * and an inner join would drop a fresh card's copies from the query entirely.
 *
 * @returns The aliased `types` column, never null.
 */
export function cardTypesColumn() {
  return sql<CardType[]>`coalesce(mca.types, '{}')`.as("types");
}

/** Requires `printings as p` joined through its first side; null on a single-sided printing. */
export function secondSideCardName() {
  return sql<string | null>`(
    SELECT sc.name FROM faces sf JOIN cards sc ON sc.id = sf.card_id WHERE sf.id = p.face2_id
  )`.as("secondSideName");
}

/** `cardName` with " // <second card>" when the printing under `printings` is double-sided. */
export function pairedCardNameSql(cardName: string, printings = "p") {
  return sql<string>`${sql.ref(cardName)} || coalesce(' // ' || (
    SELECT sc.name FROM faces sf JOIN cards sc ON sc.id = sf.card_id
    WHERE sf.id = ${sql.ref(`${printings}.face2_id`)}
  ), '')`;
}

export function pairedCardName(
  row: Parameters<typeof legendDisplayName>[0] & {
    secondSideName: string | null;
  },
): string {
  const name = legendDisplayName(row);
  return row.secondSideName === null ? name : `${name} // ${row.secondSideName}`;
}

export function selectCopyWithCard(db: Kysely<Database>) {
  return joinFaceImage(
    withFace1(db.selectFrom("copies as cp").innerJoin("printings as p", "p.id", "cp.printingId"))
      .innerJoin("cards as c", "c.id", "pf.cardId")
      .leftJoin("mvCardAggregates as mca", "mca.cardId", "c.id"),
    "pf.id",
  );
}

export interface PrintingDetail {
  cardName: string;
  setId: string;
  rarity: Rarity;
  finish: Finish;
  shortCode: string;
  language: string;
  imageId: string | null;
}

export async function printingDetailsByIds(
  db: Kysely<Database>,
  ids: string[],
): Promise<Map<string, PrintingDetail>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await joinFaceImage(
    withFace1(db.selectFrom("printings as p"))
      .innerJoin("cards as card", "card.id", "pf.cardId")
      .leftJoin("mvCardAggregates as mca", "mca.cardId", "card.id"),
    "pf.id",
  )
    .select([
      "p.id",
      "card.name as name",
      cardTypesColumn(),
      "card.tags as tags",
      secondSideCardName(),
      "pf.setId",
      "pf.rarity",
      "pf.finish",
      "pf.shortCode",
      "pf.language",
      imageId("imgf").as("imageId"),
    ])
    .where("p.id", "in", ids)
    .execute();
  return new Map(
    rows.map((row) => [
      row.id,
      {
        cardName: pairedCardName(row),
        setId: row.setId,
        rarity: row.rarity,
        finish: row.finish,
        shortCode: row.shortCode,
        language: row.language,
        imageId: row.imageId,
      },
    ]),
  );
}

/**
 * Tables whose sharing follows the `share_token`/`is_public`/`user_id` pattern.
 * `collections` is deliberately excluded: it scopes its setter by id alone.
 */
type ShareableTable = "lists" | "decks" | "tierLists" | "boardStates";

export interface ShareState {
  shareToken: string | null;
  isPublic: boolean;
}

/*
 * The helpers below cast `table` to one concrete member of ShareableTable;
 * the runtime value still supplies the real table name in the emitted SQL.
 */

/**
 * Returns undefined for "not yours" (404); a row the caller owns but never
 * shared reports `{ shareToken: null, isPublic: false }`, not undefined.
 */
export function selectShareState(
  db: Kysely<Database>,
  table: ShareableTable,
  id: string,
  userId: string,
): Promise<ShareState | undefined> {
  return db
    .selectFrom(table as "lists")
    .select(["shareToken", "isPublic"])
    .where("id", "=", id)
    .where("userId", "=", userId)
    .executeTakeFirst();
}

function shareUpdate(
  db: Kysely<Database>,
  table: ShareableTable,
  id: string,
  userId: string,
  shareToken: string | null,
  isPublic: boolean,
) {
  return db
    .updateTable(table as "lists")
    .set({ shareToken, isPublic })
    .where("id", "=", id)
    .where("userId", "=", userId);
}

/** Revoking must clear `shareToken`, not just `isPublic`, or the old link still resolves. */
export async function updateShareRow<T extends ShareableTable>(
  db: Kysely<Database>,
  table: T,
  id: string,
  userId: string,
  shareToken: string | null,
  isPublic: boolean,
): Promise<Selectable<Database[T]> | undefined> {
  const row = await shareUpdate(db, table, id, userId, shareToken, isPublic)
    .returningAll()
    .executeTakeFirst();
  return row as Selectable<Database[T]> | undefined;
}

export function updateShareState(
  db: Kysely<Database>,
  table: ShareableTable,
  id: string,
  userId: string,
  shareToken: string | null,
  isPublic: boolean,
): Promise<ShareState | undefined> {
  return shareUpdate(db, table, id, userId, shareToken, isPublic)
    .returning(["shareToken", "isPublic"])
    .executeTakeFirst();
}

/**
 * Requires `isPublic` as well as the token, so revoking kills the link even
 * if the token is still on the row.
 */
export async function findByShareToken<T extends ShareableTable>(
  db: Kysely<Database>,
  table: T,
  shareToken: string,
): Promise<
  { row: Selectable<Database[T]>; ownerName: string | null; ownerEmail: string } | undefined
> {
  const found = await db
    .selectFrom(`${table} as s` as "lists as s")
    .innerJoin("users as u", "u.id", "s.userId")
    .selectAll("s")
    .select(["u.name as ownerName", "u.email as ownerEmail"])
    .where("s.shareToken", "=", shareToken)
    .where("s.isPublic", "=", true)
    .executeTakeFirst();

  if (!found) {
    return undefined;
  }

  const { ownerName, ownerEmail, ...row } = found;
  return { row: row as Selectable<Database[T]>, ownerName, ownerEmail };
}

/**
 * WHERE predicate excluding copies pinned to a live outgoing trade: still
 * owned, but committed elsewhere. Correlates on the `cp`-aliased copy, so the
 * query must already have `copies` aliased to `cp`.
 */
export function notReservedByTrade<DB extends { cp: { id: unknown } }, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
): Expression<SqlBool> {
  const scoped = eb as unknown as ExpressionBuilder<Database & { cp: CopiesTable }, "cp">;
  return scoped.not(
    scoped.exists(
      scoped
        .selectFrom("cardTradeCopies as ctc")
        .select("ctc.copyId")
        .whereRef("ctc.copyId", "=", "cp.id"),
    ),
  );
}

/**
 * The {@link notReservedByTrade} twin for loans: a copy out on a live loan is
 * physically absent, so it counts for nothing whatever its collection says.
 * Correlates on the same `cp` alias.
 */
export function notPinnedToLoan<DB extends { cp: { id: unknown } }, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
): Expression<SqlBool> {
  const scoped = eb as unknown as ExpressionBuilder<Database & { cp: CopiesTable }, "cp">;
  return scoped.not(
    scoped.exists(
      scoped.selectFrom("loanCopies as lc").select("lc.copyId").whereRef("lc.copyId", "=", "cp.id"),
    ),
  );
}

export async function printingSideDetailsByIds(
  db: Kysely<Database>,
  ids: string[],
): Promise<Map<string, Map<string, PrintingDetail>>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await joinFaceImage(
    db
      .selectFrom("printingSidesOrdered as s")
      .innerJoin("cards as card", "card.id", "s.cardId")
      .leftJoin("mvCardAggregates as mca", "mca.cardId", "card.id"),
    "s.faceId",
  )
    .select([
      "s.printingId",
      "s.cardId",
      "card.name as name",
      cardTypesColumn(),
      "card.tags as tags",
      "s.setId",
      "s.rarity",
      "s.finish",
      "s.shortCode",
      "s.language",
      imageId("imgf").as("imageId"),
    ])
    .where("s.printingId", "in", ids)
    .orderBy("s.position")
    .execute();
  const details = new Map<string, Map<string, PrintingDetail>>();
  for (const row of rows) {
    const sides = details.get(row.printingId) ?? new Map<string, PrintingDetail>();
    if (!sides.has(row.cardId)) {
      sides.set(row.cardId, {
        cardName: legendDisplayName(row),
        setId: row.setId,
        rarity: row.rarity,
        finish: row.finish,
        shortCode: row.shortCode,
        language: row.language,
        imageId: row.imageId,
      });
    }
    details.set(row.printingId, sides);
  }
  return details;
}
