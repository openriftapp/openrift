import { describe, expect, it } from "vitest";

import { toSiteSettingResponse } from "./site-setting-presenters.js";

describe("toSiteSettingResponse", () => {
  it("maps a setting row and serializes both timestamps", () => {
    expect(
      toSiteSettingResponse({
        key: "umami-url",
        value: "https://stats.example.com",
        scope: "web",
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedAt: new Date("2026-09-02T12:00:00.000Z"),
      }),
    ).toEqual({
      key: "umami-url",
      value: "https://stats.example.com",
      scope: "web",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
    });
  });
});
