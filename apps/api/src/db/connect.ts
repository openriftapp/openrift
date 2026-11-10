import { CamelCasePlugin, Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";

import type { Database } from "./tables.js";
import { TracingDialect } from "./tracing-dialect.js";

export interface PoolSettings {
  max: number;
  // Milliseconds. Undefined keeps the server default: postgres.js drops a 0 from the startup message.
  statementTimeoutMs?: number;
  idleInTransactionTimeoutMs: number;
}

export const REQUEST_POOL: PoolSettings = {
  max: 20,
  statementTimeoutMs: 30_000,
  idleInTransactionTimeoutMs: 60_000,
};

export const BACKGROUND_POOL: PoolSettings = {
  max: 10,
  idleInTransactionTimeoutMs: 10 * 60_000,
};

export function createDb(connectionString: string, pool: PoolSettings = REQUEST_POOL) {
  const innerDialect = new PostgresJSDialect({
    postgres: postgres(connectionString, {
      max: pool.max,
      connection: {
        statement_timeout: pool.statementTimeoutMs,
        idle_in_transaction_session_timeout: pool.idleInTransactionTimeoutMs,
      },
      // kysely-postgres-js 5 prepares every query and a backend keeps each plan until the
      // connection closes.
      prepare: false,
      types: {
        // date (OID 1082) returns "2024-01-15" strings; timestamps (1114, 1184)
        // stay native Date objects.
        date: {
          to: 1082,
          from: [1082],
          serialize: (x: unknown) => (x instanceof Date ? x.toISOString() : String(x)),
          parse: (x: string) => x,
        },
      },
    }),
  });

  const dialect = new TracingDialect(innerDialect);

  return { db: new Kysely<Database>({ dialect, plugins: [new CamelCasePlugin()] }), dialect };
}
