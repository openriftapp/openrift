import { DISPLAY_LOCALES } from "@openrift/shared/types/api/preferences";
import { describe, expect, it } from "vitest";

import { locales } from "@/paraglide/runtime.js";

import { DISPLAY_LOCALE_LABELS, isDisplayLocale } from "./display-locale";

describe("display locale", () => {
  it("matches the locales Paraglide compiled", () => {
    expect([...DISPLAY_LOCALES]).toStrictEqual([...locales]);
  });

  it("labels every locale", () => {
    expect(Object.keys(DISPLAY_LOCALE_LABELS).toSorted()).toStrictEqual(
      [...DISPLAY_LOCALES].toSorted(),
    );
  });

  it("rejects anything that is not a known locale", () => {
    expect(isDisplayLocale("de")).toBe(true);
    expect(isDisplayLocale("es")).toBe(false);
    expect(isDisplayLocale(null)).toBe(false);
    expect(isDisplayLocale(undefined)).toBe(false);
  });
});
