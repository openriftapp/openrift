import type { Logger } from "@openrift/shared/logger";
import type * as KyselyMigration from "kysely/migration";
import { describe, expect, it, vi } from "vitest";

let capturedProvider: { getMigrations: () => Promise<Record<string, unknown>> } | undefined;

vi.mock("kysely/migration", async (importOriginal) => {
  const original = await importOriginal<typeof KyselyMigration>();
  return {
    ...original,
    Migrator: class MockMigrator {
      constructor(opts: any) {
        capturedProvider = opts.provider;
      }

      async migrateToLatest() {
        return { error: undefined, results: [] };
      }

      async migrateDown() {
        return { error: undefined, results: [] };
      }
    },
  };
});

// Must import after the mock
const { migrate } = await import("./migrate.js");

const noop = () => {};
function makeLog(): Logger {
  return { info: noop, warn: noop, error: noop, debug: noop } as unknown as Logger;
}

// migrate() runs assertFoldedMigrationsApplied against the executor; empty
// rows make it treat the migration table as absent and no-op.
const fakeExecutor = {
  transformQuery: (node: unknown) => node,
  compileQuery: () => ({ sql: "", parameters: [] }),
  executeQuery: () => Promise.resolve({ rows: [] }),
  withPlugins: () => fakeExecutor,
};
const fakeDb = { getExecutor: () => fakeExecutor };

describe("createMigrator provider", () => {
  it("getMigrations resolves to the migrations record", async () => {
    await migrate(fakeDb as any, makeLog());

    expect(capturedProvider).toBeDefined();
    const migrations = await capturedProvider!.getMigrations();
    expect(migrations).toBeDefined();
    expect(typeof migrations).toBe("object");
    expect(Object.keys(migrations).length).toBeGreaterThan(0);
  });
});
