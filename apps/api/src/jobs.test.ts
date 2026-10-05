import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { createJobDefinitions } from "./jobs.js";

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
