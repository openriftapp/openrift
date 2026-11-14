import { describe, expect, it } from "vitest";

import { plateFieldOptions } from "./plate-fields";

describe("plateFieldOptions", () => {
  it("lists every plate field once in display order", () => {
    expect(plateFieldOptions().map((field) => field.key)).toEqual([
      "name",
      "code",
      "stats",
      "rulesText",
      "flavorText",
    ]);
  });

  it("labels every field", () => {
    expect(plateFieldOptions().every((field) => field.label.length > 0)).toBe(true);
  });
});
