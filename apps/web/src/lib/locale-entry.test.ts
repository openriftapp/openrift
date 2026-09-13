import { describe, expect, it } from "vitest";

import {
  acceptedLanguageTags,
  browserLocaleForPageRequest,
  localeFromLanguageTags,
  hasLocaleCookie,
  localeEntryRedirect,
  withLocaleCookieRequest,
  withLocaleCookieResponse,
} from "./locale-entry";

function request(path: string, cookie?: string): Request {
  return new Request(`https://example.com${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("localeEntryRedirect", () => {
  it("ignores paths that do not start with a locale", () => {
    expect(localeEntryRedirect(request("/cards"))).toBeNull();
    expect(localeEntryRedirect(request("/decks/share/abc"))).toBeNull();
    expect(localeEntryRedirect(request("/"))).toBeNull();
    expect(localeEntryRedirect(request("/es/cards"))).toBeNull();
  });

  it("redirects to the unprefixed path and sets the locale for a first-time visitor", () => {
    const response = localeEntryRedirect(request("/de/cards"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("Location")).toBe("/cards");
    expect(response?.headers.get("Set-Cookie")).toContain("PARAGLIDE_LOCALE=de");
  });

  it("leaves an existing choice alone", () => {
    const response = localeEntryRedirect(request("/fr/cards", "PARAGLIDE_LOCALE=de"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("Location")).toBe("/cards");
    expect(response?.headers.get("Set-Cookie")).toBeNull();
  });

  it("is not fooled by another cookie whose name ends in the locale cookie's", () => {
    const response = localeEntryRedirect(request("/de/cards", "NOT_PARAGLIDE_LOCALE=de"));
    expect(response?.headers.get("Set-Cookie")).toContain("PARAGLIDE_LOCALE=de");
  });

  it("keeps the query string and normalises the bare prefix to the root", () => {
    expect(localeEntryRedirect(request("/de/cards?q=lux"))?.headers.get("Location")).toBe(
      "/cards?q=lux",
    );
    expect(localeEntryRedirect(request("/de"))?.headers.get("Location")).toBe("/");
    expect(localeEntryRedirect(request("/de/"))?.headers.get("Location")).toBe("/");
    expect(localeEntryRedirect(request("/de/cards/lux"))?.headers.get("Location")).toBe(
      "/cards/lux",
    );
  });
});

function pageRequest(headers: Record<string, string>, method = "GET"): Request {
  return new Request("https://example.com/cards", {
    method,
    headers: { accept: "text/html,application/xhtml+xml", ...headers },
  });
}

describe("browserLocaleForPageRequest", () => {
  it("takes the first supported browser language for a visitor without a choice", () => {
    expect(browserLocaleForPageRequest(pageRequest({ "accept-language": "de-AT,de;q=0.9" }))).toBe(
      "de",
    );
    expect(
      browserLocaleForPageRequest(pageRequest({ "accept-language": "es-ES,fr;q=0.8,en;q=0.5" })),
    ).toBe("fr");
  });

  it("resolves Chinese and Korean browser tags to the display locales", () => {
    expect(browserLocaleForPageRequest(pageRequest({ "accept-language": "zh-CN,zh;q=0.9" }))).toBe(
      "zh-Hans",
    );
    expect(
      browserLocaleForPageRequest(pageRequest({ "accept-language": "zh-TW,zh;q=0.9,en;q=0.8" })),
    ).toBe("zh-Hant");
    expect(browserLocaleForPageRequest(pageRequest({ "accept-language": "ko-KR,ko;q=0.9" }))).toBe(
      "ko",
    );
  });

  it("leaves a saved choice alone", () => {
    expect(
      browserLocaleForPageRequest(
        pageRequest({ "accept-language": "de", cookie: "PARAGLIDE_LOCALE=en" }),
      ),
    ).toBeNull();
  });

  it("needs no cookie when the browser prefers the base locale or nothing supported", () => {
    expect(
      browserLocaleForPageRequest(pageRequest({ "accept-language": "en-GB,de;q=0.5" })),
    ).toBeNull();
    expect(browserLocaleForPageRequest(pageRequest({ "accept-language": "es,it" }))).toBeNull();
    expect(browserLocaleForPageRequest(pageRequest({}))).toBeNull();
  });

  it("ignores requests that are not page loads", () => {
    expect(
      browserLocaleForPageRequest(
        new Request("https://example.com/_serverFn/x", { headers: { "accept-language": "de" } }),
      ),
    ).toBeNull();
    expect(
      browserLocaleForPageRequest(pageRequest({ "accept-language": "de" }, "POST")),
    ).toBeNull();
  });
});

describe("withLocaleCookieRequest", () => {
  it("adds the locale next to the existing cookies", () => {
    const next = withLocaleCookieRequest(pageRequest({ cookie: "a=1" }), "de");
    expect(next.headers.get("cookie")).toBe("a=1; PARAGLIDE_LOCALE=de");
    expect(withLocaleCookieRequest(pageRequest({}), "fr").headers.get("cookie")).toBe(
      "PARAGLIDE_LOCALE=fr",
    );
  });
});

describe("withLocaleCookieResponse", () => {
  it("pins the detected locale for later requests and keeps existing cookies", () => {
    const original = new Response("<html></html>", {
      status: 200,
      headers: { "set-cookie": "a=1; Path=/" },
    });
    const next = withLocaleCookieResponse(original, "de");
    expect(next.status).toBe(200);
    expect(next.headers.getSetCookie()).toEqual([
      "a=1; Path=/",
      expect.stringContaining("PARAGLIDE_LOCALE=de; Path=/"),
    ]);
  });
});

describe("hasLocaleCookie", () => {
  it("matches the locale cookie only by its full name", () => {
    expect(hasLocaleCookie("x=1; PARAGLIDE_LOCALE=de")).toBe(true);
    expect(hasLocaleCookie("NOT_PARAGLIDE_LOCALE=de")).toBe(false);
    expect(hasLocaleCookie("")).toBe(false);
    expect(hasLocaleCookie(null)).toBe(false);
  });
});

describe("localeFromLanguageTags", () => {
  it("prefers an exact locale, then the base language, in the browser's order", () => {
    expect(localeFromLanguageTags(["es", "fr-CA", "de"])).toBe("fr");
    expect(localeFromLanguageTags(["es", "it"])).toBeUndefined();
    expect(localeFromLanguageTags([])).toBeUndefined();
  });

  it("maps every Chinese tag to Simplified or Traditional", () => {
    expect(localeFromLanguageTags(["zh"])).toBe("zh-Hans");
    expect(localeFromLanguageTags(["zh-SG"])).toBe("zh-Hans");
    expect(localeFromLanguageTags(["zh-Hans-CN"])).toBe("zh-Hans");
    expect(localeFromLanguageTags(["zh-HK"])).toBe("zh-Hant");
    expect(localeFromLanguageTags(["zh-MO"])).toBe("zh-Hant");
    expect(localeFromLanguageTags(["zh-Hant-TW"])).toBe("zh-Hant");
    expect(localeFromLanguageTags(["zh-hant"])).toBe("zh-Hant");
  });
});

describe("acceptedLanguageTags", () => {
  it("orders tags by quality and drops empty entries", () => {
    expect(acceptedLanguageTags("en;q=0.5, de-AT, fr;q=0.8,")).toEqual(["de-AT", "fr", "en"]);
    expect(acceptedLanguageTags(null)).toEqual([]);
  });
});
