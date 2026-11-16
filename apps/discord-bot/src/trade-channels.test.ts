import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClients } from "./api-client.js";
import { log } from "./log.js";
import { TradeChannelCache } from "./trade-channels.js";

function clientsWith(tradeChannels: () => Promise<unknown>): ApiClients {
  return { discordBot: { tradeChannels } } as unknown as ApiClients;
}

const GUILDS = { guilds: [{ guildId: "guild-1", channelIds: ["chan-1", "chan-2"] }] };

describe("TradeChannelCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scans nothing before it has loaded", () => {
    const cache = new TradeChannelCache(clientsWith(() => Promise.resolve(GUILDS)));
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
  });

  it("answers for the channels it loaded, and only those", async () => {
    const cache = new TradeChannelCache(clientsWith(() => Promise.resolve(GUILDS)));
    await cache.refresh();
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(true);
    expect(cache.isTradeChannel("guild-1", "chan-9")).toBe(false);
    expect(cache.isTradeChannel("guild-9", "chan-1")).toBe(false);
    expect(cache.isTradeChannel(null, "chan-1")).toBe(false);
  });

  it("keeps the previous map when a refresh fails, rather than going dark", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(GUILDS)
      .mockRejectedValueOnce(new Error("api down"));
    vi.spyOn(log, "error").mockImplementation(() => {});
    const cache = new TradeChannelCache(clientsWith(fetcher));
    await cache.refresh();
    expect(await cache.refresh()).toBe(false);
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(true);
  });

  it("applies a /tradechannel change before the next refresh", async () => {
    const cache = new TradeChannelCache(clientsWith(() => Promise.resolve(GUILDS)));
    await cache.refresh();
    cache.set("guild-1", ["chan-2"]);
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
    expect(cache.isTradeChannel("guild-1", "chan-2")).toBe(true);
  });

  it("keeps a /tradechannel change made while a refresh was in flight", async () => {
    const pending = Promise.withResolvers<unknown>();
    const cache = new TradeChannelCache(clientsWith(() => pending.promise));
    const refreshing = cache.refresh();
    cache.set("guild-1", ["chan-9"]);
    cache.set("guild-2", []);
    pending.resolve({
      guilds: [...GUILDS.guilds, { guildId: "guild-2", channelIds: ["chan-5"] }],
    });
    await refreshing;

    expect(cache.isTradeChannel("guild-1", "chan-9")).toBe(true);
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
    expect(cache.isTradeChannel("guild-2", "chan-5")).toBe(false);
  });

  it("ignores a refresh that answers after a newer one", async () => {
    const older = Promise.withResolvers<unknown>();
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({ guilds: [{ guildId: "guild-1", channelIds: ["chan-2"] }] });
    const cache = new TradeChannelCache(clientsWith(fetcher));
    const first = cache.refresh();
    await cache.refresh();
    older.resolve(GUILDS);
    await first;

    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
    expect(cache.isTradeChannel("guild-1", "chan-2")).toBe(true);
  });

  it("takes the server's list again once a refresh starts after the change", async () => {
    const cache = new TradeChannelCache(clientsWith(() => Promise.resolve(GUILDS)));
    cache.set("guild-1", ["chan-9"]);
    await cache.refresh();
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(true);
  });

  it("forgets a guild whose last channel was turned off", async () => {
    const cache = new TradeChannelCache(clientsWith(() => Promise.resolve(GUILDS)));
    await cache.refresh();
    cache.set("guild-1", []);
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
  });

  it("stays inert when the group features are off", async () => {
    const cache = new TradeChannelCache({ discordBot: null } as unknown as ApiClients);
    await cache.start();
    expect(await cache.refresh()).toBe(false);
    expect(cache.isTradeChannel("guild-1", "chan-1")).toBe(false);
  });
});
