import { parseArgs } from "node:util";

import { BACKGROUND_POOL, createDb } from "../apps/api/src/db/connect.js";
import { errorMessage } from "../packages/shared/src/strings.js";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * A loopback host alone also matches an SSH tunnel, so the port and database name must be the dev
 * database's too (`DB_PORT` and `POSTGRES_DB` from `.env`). A tunnel bound to exactly that port
 * and name, with the dev database stopped, still passes: nothing a client sees tells them apart.
 */
export function isLocalDatabase(
  connectionString: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const url = new URL(connectionString);
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  return (
    LOCAL_HOSTS.has(url.hostname) &&
    port === (env.DB_PORT || "5432") &&
    database === (env.POSTGRES_DB || "openrift")
  );
}

function describeDatabase(connectionString: string): string {
  const url = new URL(connectionString);
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

function assertLocalDatabase(connectionString: string): void {
  if (!isLocalDatabase(connectionString)) {
    throw new Error(
      `Refusing to run against a database other than the local dev one (${describeDatabase(connectionString)}). This script is for local dev only.`,
    );
  }
}

export function assertWritableDatabase(connectionString: string, allowRemote: boolean): void {
  if (!allowRemote && !isLocalDatabase(connectionString)) {
    throw new Error(
      `Refusing to run against a database other than the local dev one (${describeDatabase(connectionString)}). Pass --allow-remote to run it anyway.`,
    );
  }
}

type OptionDefs = Record<string, { type: "boolean" | "string" }>;

export const WRITE_OPTIONS = {
  apply: { type: "boolean" },
  "allow-remote": { type: "boolean" },
} as const;

export function parseScriptArgs<const T extends OptionDefs>(
  options: T,
  usage: string,
  requiredPositionals = 0,
) {
  try {
    const parsed = parseArgs({ args: process.argv.slice(2), options, allowPositionals: true });
    if (parsed.positionals.length < requiredPositionals) {
      throw new Error("Missing argument");
    }
    return parsed;
  } catch (error) {
    console.error(`${errorMessage(error)}\n${usage}`);
    process.exit(1);
  }
}

type ScriptDb = ReturnType<typeof createDb>["db"];

export async function runWithDb(
  fn: (db: ScriptDb, databaseUrl: string) => Promise<void>,
  guard?: "local" | { allowRemote: boolean },
): Promise<void> {
  let client: ReturnType<typeof createDb> | undefined;
  try {
    const databaseUrl = requireEnv("DATABASE_URL");
    if (guard === "local") {
      assertLocalDatabase(databaseUrl);
    } else if (guard) {
      assertWritableDatabase(databaseUrl, guard.allowRemote);
    }
    client = createDb(databaseUrl, BACKGROUND_POOL);
    await fn(client.db, databaseUrl);
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  } finally {
    await client?.db.destroy();
  }
}
