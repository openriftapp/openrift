import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { cardBansRepo } from "./card-bans.js";

describe("listForCards", () => {
  it("skips the query without cards or formats", async () => {
    const recording = createRecordingDb();
    const repo = cardBansRepo(recording.db);

    expect(await repo.listForCards([], ["constructed"])).toEqual([]);
    expect(await repo.listForCards(["card-1"], [], "korea")).toEqual([]);
    expect(recording.queries).toEqual([]);
  });
});
