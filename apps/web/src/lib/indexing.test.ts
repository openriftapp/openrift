import { describe, expect, it } from "vitest";

import { buildProdRobotsTxt, isIndexableRequest, withNoindex } from "./indexing";

describe("isIndexableRequest", () => {
  it("indexes the official host", () => {
    expect(isIndexableRequest(new Request("https://openrift.app/cards"))).toBe(true);
  });

  it("does not index the preview host", () => {
    expect(isIndexableRequest(new Request("https://preview.openrift.app/cards"))).toBe(false);
  });

  it("does not index another instance", () => {
    expect(isIndexableRequest(new Request("https://openrift.example.com/cards"))).toBe(false);
  });

  it("does not index a host that only ends in the official name", () => {
    expect(isIndexableRequest(new Request("https://fake-openrift.app/cards"))).toBe(false);
  });

  it("does not index a LAN address", () => {
    expect(isIndexableRequest(new Request("http://192.168.2.17:8080/cards"))).toBe(false);
  });
});

describe("withNoindex", () => {
  it("adds the robots header and keeps status, headers and body", async () => {
    const response = withNoindex(
      new Response("<html></html>", {
        status: 404,
        headers: { "Content-Type": "text/html", "Cache-Control": "private, no-cache" },
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(await response.text()).toBe("<html></html>");
  });
});

describe("buildProdRobotsTxt", () => {
  it("disallows the auth and contribution flows", () => {
    const lines = buildProdRobotsTxt("https://example.com").split("\n");
    expect(lines).toEqual(
      expect.arrayContaining([
        "Disallow: /login",
        "Disallow: /signup",
        "Disallow: /meta/submit",
        "Disallow: /meta/*/submit",
      ]),
    );
  });

  it("points at the sitemap index on the given site", () => {
    expect(buildProdRobotsTxt("https://example.com")).toContain(
      "Sitemap: https://example.com/sitemap.xml",
    );
  });
});
