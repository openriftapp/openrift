/**
 * Drops the `openrift_test_*` databases older than `STALE_TEST_DB_AGE_MS` that have no open
 * session, and lists the ones it keeps for having one. Lists them unless `--apply` is given.
 *
 * Usage: bun db:cleanup [--apply] [--allow-remote]
 */
import {
  dropIdleTestDb,
  listTestDatabaseActivity,
  selectDroppableTestDatabases,
  STALE_TEST_DB_AGE_MS,
} from "../apps/api/src/test/integration-setup.js";
import { assertWritableDatabase, parseScriptArgs, requireEnv, WRITE_OPTIONS } from "./env.js";

const {
  values: { apply = false, "allow-remote": allowRemote = false },
} = parseScriptArgs(WRITE_OPTIONS, "Usage: bun db:cleanup [--apply] [--allow-remote]");

const databaseUrl = requireEnv("DATABASE_URL");
if (apply) {
  assertWritableDatabase(databaseUrl, allowRemote);
}
const activity = await listTestDatabaseActivity(databaseUrl);
const droppable = selectDroppableTestDatabases(activity, STALE_TEST_DB_AGE_MS);

for (const database of activity) {
  if (database.connections > 0) {
    console.log(`  in use, kept: ${database.name} (${database.connections} connection(s))`);
  }
}

if (droppable.length === 0) {
  console.log("No idle stale test databases to clean up.");
  process.exit(0);
}

if (!apply) {
  console.log(`${droppable.length} idle stale test database(s) would be dropped:`);
  for (const name of droppable) {
    console.log(`  ${name}`);
  }
  console.log("Pass --apply to drop them.");
  process.exit(0);
}

console.log(`Dropping ${droppable.length} idle stale test database(s)...`);
for (const name of droppable) {
  const dropped = await dropIdleTestDb(databaseUrl, name);
  console.log(dropped ? `  dropped ${name}` : `  in use since the check, kept: ${name}`);
}

console.log("Done.");
