import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { createJobDefinitions, withHourlyListing } from "./jobs.js";

function topdeckDefinition(topdeckApiKey: string | null) {
  const definitions = createJobDefinitions({
    config: {
      metaSync: { topdeckApiKey },
      discordWebhooks: {},
      auth: {},
    } as never,
    repos: {} as never,
    db: {} as never,
    sendEmail: vi.fn() as never,
    log: createLogger("test", "silent"),
  });
  return definitions.find((definition) => definition.kind === "meta.topdeck_sync");
}

describe("createJobDefinitions", () => {
  it("marks the Topdeck sync unavailable without an API key, so it cannot be scheduled", () => {
    expect(topdeckDefinition(null)?.unavailableReason).toBe("TOPDECK_API_KEY is not set.");
  });

  it("makes the Topdeck sync available once the key is set", () => {
    expect(topdeckDefinition("key")?.unavailableReason).toBeUndefined();
  });
});

describe("withHourlyListing", () => {
  const now = new Date("2026-11-17T12:37:00Z");

  it("lists on any minute of the hour when no run listed within the hour, and records when", async () => {
    const latestResultInstant = vi.fn(async () => null);
    const run = vi.fn(async (listing: boolean) => ({ listing }));

    const result = await withHourlyListing({ latestResultInstant }, "k", run, now);

    expect(run).toHaveBeenCalledWith(true);
    expect(result).toEqual({ listing: true, listedAt: now.toISOString() });
    expect(latestResultInstant).toHaveBeenCalledWith("k", "listedAt", expect.any(Date));
  });

  it("skips the listing when a run listed within the hour", async () => {
    const latestResultInstant = vi.fn(async () => new Date("2026-11-17T12:00:00Z"));
    const run = vi.fn(async (listing: boolean) => ({ listing }));

    const result = await withHourlyListing({ latestResultInstant }, "k", run, now);

    expect(run).toHaveBeenCalledWith(false);
    expect(result).toEqual({ listing: false });
  });
});
