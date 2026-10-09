// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  firstTouchSource,
  flushQueuedEvents,
  isNewAccount,
  parseSignupMethod,
  recordFirstTouch,
  routeTemplate,
  socialNewUserCallbackURL,
  trackEvent,
  trackSignupComplete,
  trackSignupCta,
  trackSignupSubmit,
} from "./analytics";

beforeEach(() => {
  vi.stubGlobal("umami", { track: vi.fn() });
  flushQueuedEvents();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("trackEvent", () => {
  it("forwards the name and data to umami", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });

    trackEvent("deck_exported", { format: "text", cards: 40 });

    expect(track).toHaveBeenCalledWith("deck_exported", { format: "text", cards: 40 });
  });

  it("forwards a name without data", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });

    trackEvent("scan_started");

    expect(track).toHaveBeenCalledWith("scan_started", undefined);
  });

  it("does nothing when the umami script has not loaded", () => {
    vi.stubGlobal("umami", undefined);

    expect(() => trackEvent("scan_started")).not.toThrow();
  });

  it("queues events until the script loads, then sends them once in order", () => {
    vi.stubGlobal("umami", undefined);
    trackEvent("first", { n: 1 });
    trackEvent("second");

    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    flushQueuedEvents();
    flushQueuedEvents();

    expect(track.mock.calls).toEqual([
      ["first", { n: 1 }],
      ["second", undefined],
    ]);
  });

  it("keeps the queue when flushed before the script loads", () => {
    vi.stubGlobal("umami", undefined);
    trackEvent("waiting");
    flushQueuedEvents();

    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    flushQueuedEvents();

    expect(track).toHaveBeenCalledWith("waiting", undefined);
  });

  it("caps the queue at 20 events", () => {
    vi.stubGlobal("umami", undefined);
    for (let index = 0; index < 25; index++) {
      trackEvent("event", { index });
    }

    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    flushQueuedEvents();

    expect(track).toHaveBeenCalledTimes(20);
  });
});

describe("routeTemplate", () => {
  const root = { routeId: "__root__", fullPath: "/" };
  const matchRoutes = (pathname: string) =>
    pathname.startsWith("/cards/")
      ? [root, { routeId: "/_app/cards/$cardSlug", fullPath: "/cards/$cardSlug" }]
      : [root];

  it("returns the deepest matched route pattern", () => {
    expect(routeTemplate("/cards/jinx-loose-cannon?printing=abc#top", matchRoutes)).toBe(
      "/cards/$cardSlug",
    );
  });

  it("reports an unmatched path as not-found", () => {
    expect(routeTemplate("/nowhere?x=1", matchRoutes)).toBe("not-found");
  });

  it("returns none without an href", () => {
    expect(routeTemplate(undefined, matchRoutes)).toBe("none");
  });
});

describe("firstTouchSource", () => {
  const host = "example.test";

  it("prefers utm_source", () => {
    expect(
      firstTouchSource({ search: "?utm_source=reddit", referrer: "https://google.com/", host }),
    ).toBe("reddit");
  });

  it("uses the referring host", () => {
    expect(firstTouchSource({ search: "", referrer: "https://www.google.com/search", host })).toBe(
      "www.google.com",
    );
  });

  it("treats a same-site or missing referrer as direct", () => {
    expect(firstTouchSource({ search: "", referrer: `https://${host}/cards`, host })).toBe(
      "direct",
    );
    expect(firstTouchSource({ search: "", referrer: "", host })).toBe("direct");
  });

  it("treats an unparsable referrer as direct", () => {
    expect(firstTouchSource({ search: "", referrer: "not a url", host })).toBe("direct");
  });
});

describe("signup events", () => {
  it("attaches the first touch and the clicked CTA to the conversion", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    recordFirstTouch({ path: "/cards/$cardSlug", source: "reddit" });
    recordFirstTouch({ path: "/decks", source: "direct" });
    trackSignupCta("card-page");

    trackSignupComplete("email", "/collections");

    expect(track).toHaveBeenLastCalledWith("signup-verified", {
      method: "email",
      from: "/collections",
      cta: "card-page",
      first_path: "/cards/$cardSlug",
      first_source: "reddit",
    });
  });

  it("clears the CTA after the conversion so a later signup does not reuse it", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    trackSignupCta("home-hero");
    trackSignupComplete("google", "/collections");

    trackSignupSubmit("email", "none");

    expect(track).toHaveBeenLastCalledWith("signup-submit", {
      method: "email",
      from: "none",
      cta: "none",
      first_path: "unknown",
      first_source: "unknown",
    });
  });

  it("ignores a malformed first-touch entry", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    localStorage.setItem("openrift:first-touch", "{not json");

    trackSignupComplete("discord", "none");

    expect(track).toHaveBeenLastCalledWith(
      "signup-verified",
      expect.objectContaining({ first_path: "unknown", first_source: "unknown" }),
    );
  });

  it("still tracks when storage throws", () => {
    const track = vi.fn();
    vi.stubGlobal("umami", { track });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    trackSignupComplete("email", "none");

    expect(track).toHaveBeenCalledWith(
      "signup-verified",
      expect.objectContaining({ cta: "none", first_path: "unknown" }),
    );
  });
});

describe("socialNewUserCallbackURL", () => {
  it("adds the signup flag to a path", () => {
    expect(socialNewUserCallbackURL("/collections", "google")).toBe("/collections?signup=google");
  });

  it("keeps the existing query and hash", () => {
    expect(socialNewUserCallbackURL("/lists/share/abc?tab=wants#top", "discord")).toBe(
      "/lists/share/abc?tab=wants&signup=discord#top",
    );
  });
});

describe("isNewAccount", () => {
  const now = Date.parse("2026-10-09T12:00:00.000Z");

  it("treats an account created minutes ago as new", () => {
    expect(isNewAccount("2026-10-09T11:55:00.000Z", now)).toBe(true);
  });

  it("treats an older account as existing", () => {
    expect(isNewAccount("2026-10-09T11:40:00.000Z", now)).toBe(false);
  });

  it("treats an unparsable date as existing", () => {
    expect(isNewAccount("garbage", now)).toBe(false);
  });
});

describe("parseSignupMethod", () => {
  it("accepts known methods only", () => {
    expect(parseSignupMethod("google")).toBe("google");
    expect(parseSignupMethod("github")).toBeUndefined();
    expect(parseSignupMethod(null)).toBeUndefined();
  });
});
