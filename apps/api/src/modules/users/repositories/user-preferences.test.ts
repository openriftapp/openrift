import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { userPreferencesRepo } from "./user-preferences.js";

/** The row an upsert's RETURNING gives back; content is irrelevant to these tests. */
const STORED_ROW = [
  {
    user_id: "u1",
    data: { theme: "dark" },
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("userPreferencesRepo", () => {
  it("getByUserId returns undefined when not found", async () => {
    const db = createMockDb([]);
    const repo = userPreferencesRepo(db);
    expect(await repo.getByUserId("u1")).toBeUndefined();
  });

  it("getByUserId returns parsed preferences when found", async () => {
    const data = { theme: "dark" };
    const db = createMockDb([{ userId: "u1", data, createdAt: new Date(), updatedAt: new Date() }]);
    const repo = userPreferencesRepo(db);
    const result = await repo.getByUserId("u1");
    expect(result).toBeDefined();
    expect(result!.data).toEqual(data);
  });

  it("upsert reads nothing first and returns the stored preferences", async () => {
    const { db, parameters } = createRecordingDb([STORED_ROW]);

    const result = await userPreferencesRepo(db).upsert("u1", { theme: "dark" });

    expect(parameters).toEqual([["u1", { theme: "dark" }, []]]);
    expect(result).toEqual({ theme: "dark" });
  });

  it("upsert binds the patch as an object, not as JSON text", async () => {
    const { db, parameters } = createRecordingDb([STORED_ROW]);

    await userPreferencesRepo(db).upsert("u1", { theme: "dark", showImages: false });

    expect(parameters[0]![1]).toEqual({ theme: "dark", showImages: false });
  });

  it("upsert sends null keys as key removals, apart from the patch", async () => {
    const { db, parameters } = createRecordingDb([STORED_ROW]);

    await userPreferencesRepo(db).upsert("u1", { theme: null, showImages: true });

    expect(parameters[0]).toEqual(["u1", { showImages: true }, ["theme"]]);
  });

  it("upsert skips undefined keys", async () => {
    const { db, parameters } = createRecordingDb([STORED_ROW]);

    await userPreferencesRepo(db).upsert("u1", { theme: undefined });

    expect(parameters[0]).toEqual(["u1", {}, []]);
  });
});
