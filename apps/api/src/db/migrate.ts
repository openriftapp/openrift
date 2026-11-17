import type { Logger } from "@openrift/shared/logger";
import { toError } from "@openrift/shared/strings";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { Migrator } from "kysely/migration";

import { loadMigrations } from "./migration-files.js";
import { FOLDED_MIGRATIONS } from "./migrations/_folded.js";
import type { Database } from "./tables.js";

const CORE_MIGRATION = "001-core-schema";

function createMigrator(db: Kysely<Database>) {
  return new Migrator({
    db,
    provider: { getMigrations: loadMigrations },
  });
}

// A database with the core schema but short of the squash point would run its
// missing folded migrations as no-ops and end up with an incomplete schema.
async function assertFoldedMigrationsApplied(db: Kysely<Database>): Promise<void> {
  const { rows: exists } = await sql<{ present: boolean }>`
    SELECT to_regclass('kysely_migration') IS NOT NULL AS present
  `.execute(db);
  if (!exists[0]?.present) {
    return;
  }

  const { rows } = await sql<{ name: string }>`SELECT name FROM kysely_migration`.execute(db);
  const applied = new Set(rows.map((row) => row.name));
  if (!applied.has(CORE_MIGRATION)) {
    return;
  }
  const missing = FOLDED_MIGRATIONS.filter((name) => !applied.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Database predates the migration squash: ${missing.length} folded migrations were never applied (first: ${missing[0]}). Reset or restore the database.`,
    );
  }
}

export async function migrate(db: Kysely<Database>, log: Logger): Promise<void> {
  await assertFoldedMigrationsApplied(db);

  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateToLatest();
  results?.forEach((it) => {
    if (it.status === "Success") {
      log.info(`✓ ${it.migrationName}`);
    } else if (it.status === "Error") {
      log.error(`✗ ${it.migrationName}`);
    }
  });
  if (error) {
    throw toError(error);
  }
  if (results?.length) {
    log.info("Migrations applied successfully");
  } else {
    log.info("Already up to date");
  }
}

export async function rollback(db: Kysely<Database>, log: Logger): Promise<void> {
  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateDown();
  results?.forEach((it) => {
    if (it.status === "Success") {
      log.info(`↓ ${it.migrationName}`);
    } else if (it.status === "Error") {
      log.error(`✗ ${it.migrationName}`);
    }
  });
  if (error) {
    throw toError(error);
  }
  if (results?.length) {
    log.info("Rolled back successfully");
  } else {
    log.info("Nothing to roll back");
  }
}
