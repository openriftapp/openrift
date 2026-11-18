import { sleep } from "@openrift/shared/async";
import type { Kysely, RawBuilder } from "kysely";
import { sql } from "kysely";

import type { Database } from "../db/tables.js";

export async function holdRow(db: Kysely<Database>, lockSql: RawBuilder<unknown>) {
  const holding = Promise.withResolvers<number>();
  const release = Promise.withResolvers<void>();
  const done = db.transaction().execute(async (trx) => {
    let pid: number | undefined;
    try {
      await lockSql.execute(trx);
      const { rows } = await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx);
      pid = rows[0]?.pid;
    } catch (error) {
      holding.reject(error);
      return;
    }
    if (pid === undefined) {
      holding.reject(new Error("pg_backend_pid returned no row"));
      return;
    }
    holding.resolve(pid);
    await release.promise;
  });
  const pid = await holding.promise;
  return {
    pid,
    release: async () => {
      release.resolve();
      await done;
    },
  };
}

/** Holds the tournament write lock, after running `write` in the same transaction when given. */
export function holdRoundsLock(
  db: Kysely<Database>,
  tournamentId: string,
  write?: RawBuilder<unknown>,
) {
  const lock = sql`SELECT pg_advisory_xact_lock(hashtext(${`tournament-writes:${tournamentId}`}))`;
  return holdRow(
    db,
    write === undefined
      ? lock
      : sql`WITH locked AS (${lock}), written AS (${write}) SELECT 1 FROM locked, written`,
  );
}

export async function waitUntilBlockedBy(db: Kysely<Database>, pid: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows } = await sql<{ waiting: number }>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
    `.execute(db);
    if ((rows[0]?.waiting ?? 0) > 0) {
      return;
    }
    await sleep(50);
  }
  throw new Error("the operation never waited on the held row");
}
