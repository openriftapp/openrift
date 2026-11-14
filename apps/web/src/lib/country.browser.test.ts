// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";

import { countryLabel, countryName } from "./country";

describe("countryName in the browser", () => {
  it("names the country in the locale the document started in", () => {
    expect(import.meta.env.SSR).toBe(false);
    expect(countryName("HK")).toBe("Hong Kong");
  });

  it("has no name for a locale the document did not start in", () => {
    const baseGetLocale = getLocale;
    overwriteGetLocale(() => "de");
    try {
      expect(countryName("DE")).toBeNull();
      expect(countryLabel("DE")).toBe("DE");
    } finally {
      overwriteGetLocale(baseGetLocale);
    }
  });
});
