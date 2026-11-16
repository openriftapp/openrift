import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { cardTokensRepo } from "./card-tokens.js";

describe("cardTokensRepo.recomputeForTokenCard", () => {
  it("recomputes the linked cards and the cards whose text names the token", async () => {
    const recorded = createRecordingDb([
      [{ card_id: "tok", name: "Sprite" }],
      [{ card_id: "named" }, { card_id: "linked" }],
    ]);

    await cardTokensRepo(recorded.db).recomputeForTokenCard("tok");

    const probe = recorded.queries[1]!;
    expect(probe).toContain("union");
    expect(probe).toContain('"printed_rules_text" ilike');
    expect(probe).toContain('"corrected_effect_text" ilike');
    expect(recorded.parameters[1]).toContain("%Sprite%");
    const recomputed = recorded.parameters.filter((params) => params.includes("derived"));
    expect(recomputed.flat()).toEqual(expect.arrayContaining(["named", "linked"]));
  });

  it("probes the implicit token's mention words", async () => {
    const recorded = createRecordingDb([[{ card_id: "tok", name: "XP Tracker" }], []]);

    await cardTokensRepo(recorded.db).recomputeForTokenCard("tok");

    expect(recorded.parameters[1]).toEqual(
      expect.arrayContaining(["%XP Tracker%", "%XP%", "%[Level%"]),
    );
  });

  it("only revisits the linked cards when the card is no token", async () => {
    const recorded = createRecordingDb([[], []]);

    await cardTokensRepo(recorded.db).recomputeForTokenCard("tok");

    expect(recorded.queries[1]).not.toContain("ilike");
  });
});
