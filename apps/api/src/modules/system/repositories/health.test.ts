import { Kysely } from "kysely";
import type { Dialect } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../db/tables.js";
import { healthRepo } from "./health.js";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@openrift/shared/logger", () => ({ createLogger: () => ({ warn }) }));

function createHealthMockDb(results: ({ rows: unknown[] } | Error | "hang")[]) {
  let callIndex = 0;
  const mockDriver = {
    init: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
    acquireConnection: () =>
      Promise.resolve({
        executeQuery: () => {
          const result = results[callIndex++];
          if (result === "hang") {
            return new Promise(() => {});
          }
          if (result instanceof Error) {
            return Promise.reject(result);
          }
          return Promise.resolve(result ?? { rows: [] });
        },
      }),
    beginTransaction: () => Promise.resolve(),
    commitTransaction: () => Promise.resolve(),
    rollbackTransaction: () => Promise.resolve(),
    releaseConnection: () => Promise.resolve(),
  };

  return new Kysely<Database>({
    // Only the calls healthRepo makes are stubbed; the cast stands in for the
    // rest of Kysely's Dialect surface (migration locks, streaming, query ids).
    dialect: {
      createAdapter: () => ({ supportsTransactionalDdl: true, supportsReturning: true }),
      createDriver: () => mockDriver,
      createIntrospector: () => ({}),
      createQueryCompiler: () => ({
        compileQuery: (node: any) => ({
          sql: "",
          parameters: [],
          query: node,
        }),
      }),
    } as unknown as Dialect,
  });
}

describe("healthRepo", () => {
  it("logs the failure behind 'db_unreachable'", async () => {
    warn.mockClear();
    const failure = new Error("password authentication failed");
    const mockDb = createHealthMockDb([failure]);

    expect(await healthRepo(mockDb).healthCheck(5000)).toBe("db_unreachable");
    expect(warn).toHaveBeenCalledWith({ err: failure }, "database health check failed");
  });

  it("returns 'ok' when DB is connected, migrated, and has data", async () => {
    const mockDb = createHealthMockDb([
      { rows: [{ "?column?": 1 }] },
      { rows: [{ exists: true }] },
      { rows: [{ id: "set-1" }] },
    ]);
    const repo = healthRepo(mockDb);
    const status = await repo.healthCheck(5000);
    expect(status).toBe("ok");
  });

  it("returns 'db_empty' when migrated but no data in sets", async () => {
    const mockDb = createHealthMockDb([
      { rows: [{ "?column?": 1 }] },
      { rows: [{ exists: true }] },
      { rows: [] },
    ]);
    const repo = healthRepo(mockDb);
    const status = await repo.healthCheck(5000);
    expect(status).toBe("db_empty");
  });

  it("returns 'db_not_migrated' when sets table does not exist", async () => {
    const mockDb = createHealthMockDb([
      { rows: [{ "?column?": 1 }] },
      { rows: [{ exists: false }] },
    ]);
    const repo = healthRepo(mockDb);
    const status = await repo.healthCheck(5000);
    expect(status).toBe("db_not_migrated");
  });

  it("returns 'db_unreachable' when check hangs past the timeout", async () => {
    const repo = healthRepo(createHealthMockDb(["hang"]));
    const status = await repo.healthCheck(1);
    expect(status).toBe("db_unreachable");
  });
});
