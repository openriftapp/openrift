import { describe, expect, it } from "vitest";

import { discordEmbedColorHex } from "./discord-embed.js";

describe("discordEmbedColorHex", () => {
  it("writes the embed color as a six-digit CSS hex", () => {
    expect(discordEmbedColorHex()).toBe("#24705f");
  });
});
