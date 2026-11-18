import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { cardBansRepo } from "./card-bans.js";

describe("listInEffectForCards", () => {
  it("skips the query without cards or formats", async () => {
    const recording = createRecordingDb();
    const repo = cardBansRepo(recording.db);

    expect(await repo.listInEffectForCards([], ["constructed"], "2026-09-20")).toEqual([]);
    expect(await repo.listInEffectForCards(["card-1"], [], "2026-09-20")).toEqual([]);
    expect(recording.queries).toEqual([]);
  });
});
