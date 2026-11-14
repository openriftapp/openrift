/**
 * Drops the leftover `openrift_test_*` databases of integration runs. Lists them unless
 * `--apply` is given.
 *
 * Usage: bun db:cleanup [--apply] [--allow-remote]
 */
import { dropTempDb, listTestDatabases } from "../apps/api/src/test/integration-setup.js";
import { assertWritableDatabase, parseScriptArgs, requireEnv, WRITE_OPTIONS } from "./env.js";

const {
  values: { apply = false, "allow-remote": allowRemote = false },
} = parseScriptArgs(WRITE_OPTIONS, "Usage: bun db:cleanup [--apply] [--allow-remote]");

const databaseUrl = requireEnv("DATABASE_URL");
if (apply) {
  assertWritableDatabase(databaseUrl, allowRemote);
}
const databases = await listTestDatabases(databaseUrl);

if (databases.length === 0) {
  console.log("No test databases to clean up.");
  process.exit(0);
}

if (!apply) {
  console.log(`${databases.length} test database(s) would be dropped:`);
  for (const name of databases) {
    console.log(`  ${name}`);
  }
  console.log("Pass --apply to drop them.");
  process.exit(0);
}

console.log(`Dropping ${databases.length} test database(s)...`);
for (const name of databases) {
  await dropTempDb(databaseUrl, name);
  console.log(`  dropped ${name}`);
}

console.log("Done.");
