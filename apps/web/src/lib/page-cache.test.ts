import { describe, expect, it } from "vitest";

import { applyPageCacheControl } from "./page-cache";

const PUBLIC = "public, max-age=300, stale-while-revalidate=3600";
const PRIVATE = "private, no-cache";

function htmlResponse(extraHeaders: Record<string, string> = {}, status = 200): Response {
  return new Response("<html></html>", {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      ...extraHeaders,
    },
  });
}

function getRequest(
  path: string,
  extraHeaders: Record<string, string> = {},
  method = "GET",
): Request {
  return new Request(`https://example.com${path}`, {
    method,
    headers: { ...extraHeaders },
  });
}

describe("applyPageCacheControl", () => {
  it("emits public cache headers for anonymous GETs on cacheable public pages", () => {
    const result = applyPageCacheControl(getRequest("/cards"), htmlResponse());
    expect(result.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("emits the same public cache headers on the homepage", () => {
    const result = applyPageCacheControl(getRequest("/"), htmlResponse());
    expect(result.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("refuses to publicly cache a page rendered in a non-base locale", () => {
    const german = applyPageCacheControl(
      getRequest("/cards", { cookie: "PARAGLIDE_LOCALE=de" }),
      htmlResponse(),
    );
    const english = applyPageCacheControl(
      getRequest("/cards", { cookie: "PARAGLIDE_LOCALE=en" }),
      htmlResponse(),
    );
    expect(german.headers.get("Cache-Control")).toBe(PRIVATE);
    expect(english.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("caches card and set detail pages via prefix match", () => {
    const cardDetail = applyPageCacheControl(getRequest("/cards/lux"), htmlResponse());
    const setDetail = applyPageCacheControl(getRequest("/sets/origins"), htmlResponse());
    expect(cardDetail.headers.get("Cache-Control")).toBe(PUBLIC);
    expect(setDetail.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("lets the edge keep a dated ruleset document for a day", () => {
    const versioned = applyPageCacheControl(getRequest("/rules/core/2026-07-16"), htmlResponse());
    expect(versioned.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400",
    );
  });

  it("lets the edge keep a dated ruleset document in a chosen language for a day", () => {
    const translated = applyPageCacheControl(
      getRequest("/rules/core/2026-07-16?lang=fr"),
      htmlResponse(),
    );
    expect(translated.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400",
    );
  });

  it("caches the redirect from a dated ruleset to its language for anonymous visitors", () => {
    const redirected = applyPageCacheControl(
      getRequest("/rules/core/2026-07-16"),
      new Response(null, {
        status: 307,
        headers: { Location: "/rules/core/2026-07-16?lang=en" },
      }),
    );
    expect(redirected.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("keeps the short public TTL on a dated ruleset with a search query, which no purge reaches", () => {
    const searched = applyPageCacheControl(
      getRequest("/rules/core/2026-07-16?q=might"),
      htmlResponse(),
    );
    expect(searched.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("keeps the short public TTL on undated rules paths", () => {
    const undated = applyPageCacheControl(getRequest("/rules/core/draft"), htmlResponse());
    expect(undated.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("caches the redirect from a rules kind to its latest version for anonymous visitors", () => {
    const redirect = () =>
      new Response(null, { status: 307, headers: { Location: "/rules/core/2026-07-16" } });
    const anonymous = applyPageCacheControl(getRequest("/rules/core"), redirect());
    const signedIn = applyPageCacheControl(
      getRequest("/rules/core", { cookie: "better-auth.session_token=abc" }),
      redirect(),
    );
    expect(anonymous.headers.get("Cache-Control")).toBe(PUBLIC);
    expect(anonymous.headers.get("Location")).toBe("/rules/core/2026-07-16");
    expect(signedIn.headers.get("Cache-Control")).toBeNull();
  });

  it("leaves other redirects alone", () => {
    const response = new Response(null, { status: 307, headers: { Location: "/login" } });
    expect(applyPageCacheControl(getRequest("/collections"), response)).toBe(response);
  });

  it("caches the products index and product detail pages", () => {
    const index = applyPageCacheControl(getRequest("/products"), htmlResponse());
    const detail = applyPageCacheControl(
      getRequest("/products/origins-proving-grounds"),
      htmlResponse(),
    );
    expect(index.headers.get("Cache-Control")).toBe(PUBLIC);
    expect(detail.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("keeps product pages private for logged-in users", () => {
    const result = applyPageCacheControl(
      getRequest("/products/origins-proving-grounds", {
        cookie: "better-auth.session_token=abc",
      }),
      htmlResponse(),
    );
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("caches the help center, the meta archive and the static marketing pages", () => {
    for (const path of [
      "/help",
      "/help/getting-started",
      "/meta",
      "/meta/events",
      "/meta/legends/ahri",
      "/changelog",
      "/roadmap",
      "/features",
      "/support",
      "/legal-notice",
    ]) {
      expect(
        applyPageCacheControl(getRequest(path), htmlResponse()).headers.get("Cache-Control"),
        path,
      ).toBe(PUBLIC);
    }
  });

  it("caches every public share surface for anonymous viewers", () => {
    for (const path of [
      "/decks/share/tok",
      "/collections/share/tok",
      "/lists/share/tok",
      "/tier-lists/share/tok",
      "/users/share/tok",
      "/users/share/tok/lists/l1",
    ]) {
      expect(
        applyPageCacheControl(getRequest(path), htmlResponse()).headers.get("Cache-Control"),
        path,
      ).toBe(PUBLIC);
    }
  });

  it("keeps the deck builder, contribute and tournament token pages private", () => {
    for (const path of [
      "/decks",
      "/decks/abc",
      "/contribute",
      "/tournaments/submit/tok",
      "/stage",
    ]) {
      expect(
        applyPageCacheControl(getRequest(path), htmlResponse()).headers.get("Cache-Control"),
        path,
      ).toBe(PRIVATE);
    }
  });

  it("still caches the /rules index itself", () => {
    const index = applyPageCacheControl(getRequest("/rules"), htmlResponse());
    expect(index.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("keeps ruleset documents private for logged-in users", () => {
    const result = applyPageCacheControl(
      getRequest("/rules/core/2026-07-16", { cookie: "better-auth.session_token=abc" }),
      htmlResponse(),
    );
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("applies cache headers to HEAD requests too", () => {
    const result = applyPageCacheControl(getRequest("/cards", {}, "HEAD"), htmlResponse());
    expect(result.headers.get("Cache-Control")).toBe(PUBLIC);
  });

  it("forces private no-cache for logged-in users on public pages", () => {
    const result = applyPageCacheControl(
      getRequest("/cards", { cookie: "better-auth.session_token=abc123" }),
      htmlResponse(),
    );
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("matches the __Secure- prefixed session cookie too", () => {
    const result = applyPageCacheControl(
      getRequest("/cards", { cookie: "__Secure-better-auth.session_token=abc123" }),
      htmlResponse(),
    );
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("forces private no-cache on non-cacheable paths like /login", () => {
    const result = applyPageCacheControl(getRequest("/login"), htmlResponse());
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("forces private no-cache when the response carries Set-Cookie", () => {
    const result = applyPageCacheControl(
      getRequest("/cards"),
      htmlResponse({ "Set-Cookie": "foo=bar" }),
    );
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("forces private no-cache on non-200 responses so errors are not cached", () => {
    const result = applyPageCacheControl(getRequest("/cards"), htmlResponse({}, 500));
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("forces private no-cache on non-GET, non-HEAD HTML responses", () => {
    const result = applyPageCacheControl(getRequest("/cards", {}, "POST"), htmlResponse());
    expect(result.headers.get("Cache-Control")).toBe(PRIVATE);
  });

  it("leaves non-HTML responses alone so JSON server-fn responses are untouched", () => {
    const response = new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    });
    const result = applyPageCacheControl(getRequest("/cards"), response);
    expect(result).toBe(response);
    expect(result.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("replaces any existing Cache-Control rather than appending", () => {
    const result = applyPageCacheControl(getRequest("/cards"), htmlResponse());
    const allHeaders = [...result.headers.entries()].filter(
      ([key]) => key.toLowerCase() === "cache-control",
    );
    expect(allHeaders).toHaveLength(1);
    expect(allHeaders[0]?.[1]).toBe(PUBLIC);
  });

  it("keeps the Link header Start appended for Early Hints", () => {
    const link = "</assets/font.woff2>; rel=preload; as=font; crossorigin=anonymous";
    const result = applyPageCacheControl(getRequest("/cards"), htmlResponse({ Link: link }));
    expect(result.headers.get("Link")).toBe(link);
  });

  it("adds no Link header of its own", () => {
    const result = applyPageCacheControl(getRequest("/cards"), htmlResponse());
    expect(result.headers.get("Link")).toBeNull();
  });
});
