import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { friendGroupDiscordLinksRepo } from "./friend-group-discord-links.js";

const PENDING_ROW = {
  id: "link-pending",
  group_id: "group-a",
  guild_id: null,
  guild_name: null,
  code: "abc123",
  code_expires_at: new Date("2099-01-01T00:00:00.000Z"),
  created_by_user_id: "user-1",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  linked_at: null,
  trade_channel_ids: [],
};

const REDEEM = { code: "abc123", guildId: "guild-1", guildName: "Summoner Skirmish" } as const;

describe("friendGroupDiscordLinksRepo.redeemCode", () => {
  it("rolls back when a statement fails after the code was claimed, leaving the code neither spent nor unlinked", async () => {
    const { db, queries, events } = createRecordingDb([
      [PENDING_ROW],
      [],
      [],
      new Error("connection reset"),
    ]);

    await expect(friendGroupDiscordLinksRepo(db).redeemCode(REDEEM)).rejects.toThrow(
      "connection reset",
    );
    expect(events).toEqual(["begin", "rollback"]);
    expect(queries).toHaveLength(4);
  });
});
