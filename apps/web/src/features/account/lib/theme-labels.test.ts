import { describe, expect, it } from "vitest";

import { themeLabels } from "./theme-labels";

describe("themeLabels", () => {
  it("names every theme preference", () => {
    expect(themeLabels()).toEqual({ auto: "Auto", light: "Light", dark: "Dark" });
  });
});
