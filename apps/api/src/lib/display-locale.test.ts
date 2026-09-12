import { describe, expect, it } from "vitest";

import { displayLocaleFromRequest, resolveDisplayLocale } from "./display-locale.js";

describe("resolveDisplayLocale", () => {
  it("keeps a supported locale", () => {
    expect(resolveDisplayLocale("de")).toBe("de");
    expect(resolveDisplayLocale("fr")).toBe("fr");
  });

  it("falls back to English for an unknown or missing value", () => {
    expect(resolveDisplayLocale("pt-BR")).toBe("en");
    expect(resolveDisplayLocale("")).toBe("en");
    expect(resolveDisplayLocale(undefined)).toBe("en");
    expect(resolveDisplayLocale(null)).toBe("en");
    expect(resolveDisplayLocale(7)).toBe("en");
  });
});

function requestWithCookie(cookie: string): Request {
  return new Request("https://openrift.app/api/auth/sign-in", { headers: { cookie } });
}

describe("displayLocaleFromRequest", () => {
  it("reads the locale cookie the web app sets", () => {
    expect(displayLocaleFromRequest(requestWithCookie("PARAGLIDE_LOCALE=fr"))).toBe("fr");
  });

  it("finds the cookie among others and decodes it", () => {
    const request = requestWithCookie("better-auth.session_token=x; PARAGLIDE_LOCALE=de; other=1");

    expect(displayLocaleFromRequest(request)).toBe("de");
  });

  it("returns undefined without a usable cookie, so the caller can fall back", () => {
    expect(displayLocaleFromRequest(undefined)).toBeUndefined();
    expect(displayLocaleFromRequest(requestWithCookie("other=1"))).toBeUndefined();
    expect(displayLocaleFromRequest(requestWithCookie("PARAGLIDE_LOCALE=pt-BR"))).toBeUndefined();
  });
});
