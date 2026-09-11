import { describe, expect, it } from "vitest";

import { localeEntryRedirect } from "./locale-entry";

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
