import { describe, expect, it } from "vitest";

import { AppError } from "../../../errors.js";
import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { adminEventsRepo } from "./admin-events.js";

describe("adminEventsRepo", () => {
  it("list returns rows without a cursor", async () => {
    const db = createMockDb([]);
    const repo = adminEventsRepo(db);
    expect(await repo.list({}, 20)).toEqual([]);
  });

  it("list takes LIKE wildcards in the search term literally", async () => {
    const { db, parameters } = createRecordingDb();

    await adminEventsRepo(db).list({ search: "50%_off" }, 20);

    expect(parameters[0]).toContain(String.raw`%50\%\_off%`);
  });

  it("list applies cursor filter when provided", async () => {
    const db = createMockDb([]);
    const repo = adminEventsRepo(db);
    expect(await repo.list({}, 20, "2026-01-01T00:00:00.000Z_ae-last")).toEqual([]);
  });

  it("list rejects an unparseable cursor with a 400 AppError instead of reaching the query as an Invalid Date", async () => {
    const db = createMockDb([]);
    const repo = adminEventsRepo(db);
    await expect(repo.list({}, 20, "not-a-date")).rejects.toBeInstanceOf(AppError);
    await expect(repo.list({}, 20, "not-a-date")).rejects.toMatchObject({ status: 400 });
  });
});
