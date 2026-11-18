import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { siteSettingsRepo } from "./site-settings.js";

describe("siteSettingsRepo", () => {
  it.each([
    { name: "reads an explicit false", value: "false", expected: false },
    { name: "reads an explicit true", value: "true", expected: true },
    { name: "treats an unrecognised value as on", value: "off", expected: true },
  ])("getBool $name", async ({ value, expected }) => {
    const db = createMockDb([{ value }]);
    const repo = siteSettingsRepo(db);
    expect(await repo.getBool("trade-match-digest")).toBe(expected);
  });

  it("getBool returns undefined for a key that does not exist", async () => {
    const db = createMockDb([]);
    const repo = siteSettingsRepo(db);
    expect(await repo.getBool("nope")).toBeUndefined();
  });
});
