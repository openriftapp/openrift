import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaLegendsRepo } from "./meta-legends.js";
import { metaPlayersRepo } from "./meta-players.js";

const TOTAL_FINISH_ORDER =
  'order by "me"."event_date" desc, "p"."rank" asc, "me"."name" asc, "p"."id" asc';

describe("finish order", () => {
  it("orders a player's finishes totally, so the heading row never flips", async () => {
    const recording = createRecordingDb([[]]);

    await metaLegendsRepo(recording.db).finishesForPlayer("ekko");

    expect(recording.queries[0]).toContain(TOTAL_FINISH_ORDER);
  });

  it("orders a legend's finishes the same way", async () => {
    const recording = createRecordingDb([[]]);

    await metaLegendsRepo(recording.db).finishesForLegend("legend-id");

    expect(recording.queries[0]).toContain(TOTAL_FINISH_ORDER);
  });

  it("breaks a tied best finish per legend by name, like the standings", async () => {
    const recording = createRecordingDb([[]]);

    await metaPlayersRepo(recording.db).bestPerLegendForEvent("event-id");

    expect(recording.queries[0]).toContain(
      "order by p.rank asc, coalesce(p.player_name, up.display_name) asc, p.id asc",
    );
  });
});
