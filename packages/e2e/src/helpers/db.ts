import { readFileSync } from "node:fs";

import postgres from "postgres";

import type { E2eState } from "./constants.js";
import { STATE_FILE } from "./constants.js";

// Re-implements apps/api/src/test/integration-setup.ts to avoid importing
// across workspaces (the API package has no build step).
const noop = () => {};

export function replaceDbName(url: string, dbName: string): string {
  return url.replace(/\/[^/?]+(?<suffix>\?|$)/u, `/${dbName}$<suffix>`);
}

export async function createTempDb(databaseUrl: string, label: string): Promise<string> {
  const name = `openrift_test_${label}_${Date.now()}`;
  const adminSql = postgres(replaceDbName(databaseUrl, "postgres"), { onnotice: noop });
  await adminSql.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
  await adminSql.unsafe(`CREATE DATABASE "${name}"`);
  await adminSql.end();
  return name;
}

export async function dropTempDb(databaseUrl: string, name: string): Promise<void> {
  const sql = postgres(replaceDbName(databaseUrl, "postgres"), { onnotice: noop });
  await sql.unsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid()`,
  );
  await sql.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
  await sql.end();
}

export function connectToDb(url: string) {
  return postgres(url, { onnotice: noop });
}

function connectToTempDb() {
  const state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as E2eState;
  return connectToDb(state.tempDbUrl);
}

// deadlock_detected and serialization_failure; Postgres aborts one side and
// both are safe to replay.
const RETRYABLE_SQL_STATES = new Set(["40P01", "40001"]);

// Parallel workers cascade-delete through the same child tables in opposite
// orders, so a losing cleanup must retry instead of failing that test.
export async function deleteUser(email: string, attempts = 5): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const sql = connectToTempDb();
    try {
      await sql`DELETE FROM users WHERE email = ${email}`;
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= attempts || code === undefined || !RETRYABLE_SQL_STATES.has(code)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    } finally {
      await sql.end();
    }
  }
}
