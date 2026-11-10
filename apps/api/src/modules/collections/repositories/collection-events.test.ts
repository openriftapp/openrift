import { describe, expect, it } from "vitest";

import { AppError } from "../../../errors.js";
import { MAX_BIND_PARAMETERS } from "../../../lib/bind-batches.js";
import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { collectionEventsRepo } from "./collection-events.js";

describe("collectionEventsRepo", () => {
  it("listForUser returns events without cursor", async () => {
    const rows = [{ id: "e1", action: "add", createdAt: new Date() }];
    const db = createMockDb(rows);
    const repo = collectionEventsRepo(db);
    expect(await repo.listForUser("u1", 20)).toEqual(rows);
  });

  it("listForUser applies cursor filter when provided", async () => {
    const db = createMockDb([]);
    const repo = collectionEventsRepo(db);
    expect(await repo.listForUser("u1", 20, "2026-01-01T00:00:00.000Z_e-last")).toEqual([]);
  });

  it("listForUser rejects an unparseable cursor with a 400 AppError instead of an Invalid Date reaching the query", () => {
    const db = createMockDb([]);
    const repo = collectionEventsRepo(db);
    expect(() => repo.listForUser("u1", 20, "not-a-date")).toThrow(AppError);
    try {
      void repo.listForUser("u1", 20, "not-a-date");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(400);
    }
  });

  it("insert is a no-op for empty array", async () => {
    const db = createMockDb([]);
    const repo = collectionEventsRepo(db);
    await expect(repo.insert([])).resolves.toBeUndefined();
  });

  it("insert inserts items", async () => {
    const db = createMockDb([]);
    const repo = collectionEventsRepo(db);
    await expect(
      repo.insert([
        {
          userId: "u1",
          action: "added",
          printingId: "p1",
          copyId: "c1",
          fromCollectionId: null,
          fromCollectionName: null,
          toCollectionId: "col1",
          toCollectionName: "Inbox",
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it("insert splits a collection-sized event batch under the bind-parameter limit", async () => {
    const recorded = createRecordingDb();
    const repo = collectionEventsRepo(recorded.db);
    const items = Array.from({ length: 9000 }, (_, index) => ({
      userId: "u1",
      action: "moved" as const,
      printingId: "p1",
      copyId: `c${index}`,
      fromCollectionId: "col1",
      fromCollectionName: "Binder",
      toCollectionId: "col2",
      toCollectionName: "Inbox",
    }));

    await repo.insert(items);

    expect(recorded.parameters.length).toBeGreaterThan(1);
    for (const parameters of recorded.parameters) {
      expect(parameters.length).toBeLessThanOrEqual(MAX_BIND_PARAMETERS);
    }
    expect(recorded.parameters.flat()).toHaveLength(9000 * 8);
  });
});
