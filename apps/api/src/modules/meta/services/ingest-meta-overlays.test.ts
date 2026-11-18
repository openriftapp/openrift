import { describe, expect, it } from "vitest";

import { playerSourceKey, splitSourcePlayerKey } from "./ingest-meta-overlays.js";

describe("splitSourcePlayerKey", () => {
  it.each([
    { name: "plain ids", event: "evt-1", player: "p1" },
    { name: "ids holding the separator character", event: "evt:1", player: "12:p1" },
    { name: "an empty event half", event: "", player: "p1" },
  ])("splits a pushed row's key back into the two ids for $name", ({ event, player }) => {
    expect(splitSourcePlayerKey(playerSourceKey(event, player))).toEqual({
      eventExternalId: event,
      playerExternalId: player,
    });
  });

  it("answers with neither id for a row no provider keyed", () => {
    expect(splitSourcePlayerKey(null)).toEqual({
      eventExternalId: null,
      playerExternalId: null,
    });
  });

  it("answers with neither id for a key carrying no length prefix at all", () => {
    expect(splitSourcePlayerKey("evt-1")).toEqual({
      eventExternalId: null,
      playerExternalId: null,
    });
  });

  it("answers with neither id for a length prefix reaching past the key", () => {
    expect(splitSourcePlayerKey("99:evt-1p1")).toEqual({
      eventExternalId: null,
      playerExternalId: null,
    });
  });
});
