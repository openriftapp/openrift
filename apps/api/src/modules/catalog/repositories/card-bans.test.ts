import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { cardBansRepo } from "./card-bans.js";

describe("listInEffectForCards", () => {
  it("selects the bans in effect on the given day, lifted ones included", async () => {
    const recording = createRecordingDb();

    await cardBansRepo(recording.db).listInEffectForCards(
      ["card-1"],
      ["constructed"],
      "2026-09-20",
    );

    expect(recording.queries).toEqual([
      'select "card_id", "format_id" from "card_bans" where "card_id" in ($1) and "format_id" in ($2) and "banned_at" <= $3 and ("unbanned_at" is null or "unbanned_at" > $4)',
    ]);
    expect(recording.parameters[0]).toEqual(["card-1", "constructed", "2026-09-20", "2026-09-20"]);
  });

  it("skips the query without cards or formats", async () => {
    const recording = createRecordingDb();
    const repo = cardBansRepo(recording.db);

    expect(await repo.listInEffectForCards([], ["constructed"], "2026-09-20")).toEqual([]);
    expect(await repo.listInEffectForCards(["card-1"], [], "2026-09-20")).toEqual([]);
    expect(recording.queries).toEqual([]);
  });
});
